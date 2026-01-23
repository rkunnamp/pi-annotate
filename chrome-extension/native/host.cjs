#!/usr/bin/env node
const net = require("net");
const fs = require("fs");

const SOCKET_PATH = "/tmp/pi-annotate.sock";
const LOG_FILE = "/tmp/pi-annotate-host.log";

const log = (msg) => {
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
};

log("Host starting...");

// Clean up old socket
try { fs.unlinkSync(SOCKET_PATH); } catch {}

// Store connected pi client
let piSocket = null;

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

// Messages from Chrome extension → forward to Pi
function handleExtensionMessage(msg) {
  log(`From extension: ${JSON.stringify(msg)}`);
  
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
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (err) => {
  log(`Uncaught exception: ${err.message}`);
  cleanup();
});

// Unix socket server for Pi extension
const server = net.createServer((socket) => {
  log("Pi client connected");
  piSocket = socket;
  
  let buffer = "";
  
  socket.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        // Forward to Chrome extension
        log(`From Pi: ${JSON.stringify(msg)}`);
        writeMessage(msg);
      } catch (e) {
        log(`Pi parse error: ${e.message}`);
      }
    }
  });
  
  socket.on("close", () => {
    log("Pi client disconnected");
    piSocket = null;
  });
  
  socket.on("error", (e) => log(`Socket error: ${e.message}`));
});

server.listen(SOCKET_PATH, () => {
  log(`Listening on ${SOCKET_PATH}`);
});
