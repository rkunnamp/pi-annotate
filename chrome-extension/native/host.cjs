#!/usr/bin/env node
const net = require("net");
const fs = require("fs");

const SOCKET_PATH = "/tmp/pi-annotate.sock";
const TOKEN_PATH = "/tmp/pi-annotate.token";
const LOG_FILE = "/tmp/pi-annotate-host.log";
const MAX_NATIVE_MESSAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_SOCKET_BUFFER = 8 * 1024 * 1024; // 8MB
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB

process.umask(0o077);

function rotateLogIfNeeded() {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
  } catch {}
}

const log = (msg) => {
  rotateLogIfNeeded();
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
};

log("Host starting...");

// IMPORTANT (MV3 + native messaging): Chrome may spawn multiple native host
// processes over time (popup checks, service worker restarts, etc.). If every
// new process blindly deletes /tmp/pi-annotate.sock + token, it can break an
// existing, healthy host that Pi is currently connected to.
//
// To avoid this:
// - We only remove the socket file if nothing is listening on it (stale file).
// - We never delete the token/socket on exit (prevents races between old/new).

function isSocketListening(sockPath, timeoutMs = 150) {
  return new Promise((resolve) => {
    const client = net.createConnection(sockPath);
    const done = (ok) => {
      try { client.destroy(); } catch {}
      resolve(ok);
    };
    const t = setTimeout(() => done(false), timeoutMs);
    client.on("connect", () => {
      clearTimeout(t);
      done(true);
    });
    client.on("error", () => {
      clearTimeout(t);
      done(false);
    });
  });
}

// Store connected pi client
let piSocket = null;
let piAuthed = false;

function ensureToken() {
  // Reuse existing token if present. This prevents a short-lived helper host
  // (e.g. popup connection check) from overwriting the token that Pi needs to
  // authenticate with the main host.
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const existing = fs.readFileSync(TOKEN_PATH, "utf8").trim();
      if (existing) return existing;
    }
  } catch {}

  try {
    const token = require("crypto").randomBytes(32).toString("hex");
    fs.writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
    return token;
  } catch (err) {
    log(`Failed to create token: ${err.message}`);
    return null;
  }
}

let AUTH_TOKEN = null;

// Native messaging I/O
let inputBuffer = Buffer.alloc(0);

function writeMessage(msg) {
  const json = JSON.stringify(msg);
  const len = Buffer.alloc(4);
  len.writeUInt32LE(json.length);
  process.stdout.write(len);
  process.stdout.write(json);
}

function processInput() {
  while (inputBuffer.length >= 4) {
    const len = inputBuffer.readUInt32LE(0);
    if (len > MAX_NATIVE_MESSAGE_BYTES) {
      log(`Native message too large: ${len}`);
      inputBuffer = Buffer.alloc(0);
      return;
    }
    if (inputBuffer.length < 4 + len) break;
    
    const json = inputBuffer.slice(4, 4 + len).toString();
    inputBuffer = inputBuffer.slice(4 + len);
    
    try {
      const msg = JSON.parse(json);
      handleExtensionMessage(msg);
    } catch (e) {
      log(`Parse error: ${e.message}`);
    }
  }
}

function redactForLog(msg) {
  return JSON.stringify(msg, (key, value) => {
    if (key === "screenshot") return "[redacted]";
    if (key === "screenshots") return Array.isArray(value) ? `[${value.length} screenshots]` : "[redacted]";
    if (key === "dataUrl") return "[redacted]";
    return value;
  });
}

// Messages from Chrome extension → forward to Pi
function handleExtensionMessage(msg) {
  log(`From extension: ${redactForLog(msg)}`);
  
  // Health check - respond immediately without forwarding
  if (msg?.type === "PING") {
    writeMessage({ type: "PONG", timestamp: Date.now() });
    return;
  }
  
  if (piSocket && !piSocket.destroyed) {
    piSocket.write(JSON.stringify(msg) + "\n");
  } else {
    log("No pi client connected, message dropped");
  }
}

process.stdin.on("readable", () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);
    processInput();
  }
});

process.stdin.on("end", () => {
  log("Extension disconnected");
  cleanup();
});

function cleanup() {
  // Do NOT unlink SOCKET_PATH/TOKEN_PATH here.
  // Multiple host processes can overlap briefly; an older one exiting could
  // delete the newer one's live socket/token and break Pi connectivity.
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (err) => {
  log(`Uncaught exception: ${err.message}`);
  cleanup();
});

async function start() {
  // If another instance is already listening on the unix socket, we run in a
  // safe companion mode (PING/PONG works, but we do not touch the socket/token).
  // This prevents popup checks from breaking the main host.
  let companionMode = false;
  try {
    if (fs.existsSync(SOCKET_PATH)) {
      const active = await isSocketListening(SOCKET_PATH);
      if (active) {
        companionMode = true;
        log(`Socket already active at ${SOCKET_PATH}; starting in companion mode`);
      } else {
        // Stale socket file, safe to remove
        try { fs.unlinkSync(SOCKET_PATH); } catch {}
      }
    }
  } catch {}

  AUTH_TOKEN = ensureToken();

  if (companionMode) {
    // No unix socket server.
    return;
  }

  // Unix socket server for Pi extension
  const server = net.createServer((socket) => {
    log("Pi client connected");
    
    // If another Pi client is already connected, replace it
    if (piSocket && !piSocket.destroyed) {
      if (piAuthed) {
        log("Replacing existing authenticated Pi client");
        try {
          piSocket.write(JSON.stringify({ 
            type: "SESSION_REPLACED", 
            reason: "Another terminal started annotation" 
          }) + "\n");
        } catch (e) {
          log(`Error notifying old client: ${e.message}`);
        }
      } else {
        log("Replacing existing unauthenticated Pi client");
      }
      piSocket.destroy();
    }
    
    piSocket = socket;
    piAuthed = false;
    
    let buffer = "";
    
    socket.on("data", (data) => {
      buffer += data.toString();
      if (buffer.length > MAX_SOCKET_BUFFER) {
        log("Pi socket buffer overflow, closing connection");
        socket.destroy();
        buffer = "";
        return;
      }
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (!piAuthed) {
            if (msg?.type === "AUTH" && AUTH_TOKEN && msg.token === AUTH_TOKEN) {
              piAuthed = true;
              log("Pi client authenticated");
            } else {
              log("Pi client authentication failed");
              socket.destroy();
              return;
            }
          } else {
            // Forward to Chrome extension
            log(`From Pi: ${redactForLog(msg)}`);
            writeMessage(msg);
          }
        } catch (e) {
          log(`Pi parse error: ${e.message}`);
        }
      }
    });
    
    socket.on("close", () => {
      log("Pi client disconnected");
      // Only clear if this is still the active socket (handles takeover race)
      if (piSocket === socket) {
        piSocket = null;
        piAuthed = false;
      }
    });
    
    socket.on("error", (e) => log(`Socket error: ${e.message}`));
  });

  server.listen(SOCKET_PATH, () => {
    log(`Listening on ${SOCKET_PATH}`);
    try { fs.chmodSync(SOCKET_PATH, 0o600); } catch {}
  });
}

start().catch((err) => {
  log(`Fatal start error: ${err?.message || err}`);
  cleanup();
});
