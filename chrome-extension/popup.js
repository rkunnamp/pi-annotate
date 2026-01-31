// Pi Annotate - Popup Script

const extId = chrome.runtime.id;
const installCmd = `./install.sh ${extId}`;

// Elements
const extIdInput = document.getElementById('ext-id');
const installCmdInput = document.getElementById('install-cmd');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const setupSection = document.getElementById('setup-section');
const readySection = document.getElementById('ready-section');
const troubleSection = document.getElementById('trouble-section');

// Populate fields
extIdInput.value = extId;
installCmdInput.value = installCmd;

// Platform-aware displays
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const shortcutEl = document.getElementById('shortcut-key');
if (shortcutEl) {
  shortcutEl.textContent = isMac ? '⌘ Shift P' : 'Ctrl+Shift+P';
}
const quitTipEl = document.getElementById('quit-tip');
if (quitTipEl) {
  // Mac has ⌘Q, Windows/Linux don't have a universal quit shortcut
  quitTipEl.textContent = isMac 
    ? 'Fully quit Chrome (⌘Q) and reopen' 
    : 'Fully quit Chrome (menu → Exit) and reopen';
}

// Copy functionality
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1500);
  }).catch(() => {
    // Fallback: select the input text
    const input = btn.previousElementSibling;
    if (input?.select) {
      input.select();
      btn.textContent = 'Select All';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }
  });
}

document.getElementById('copy-id').addEventListener('click', (e) => {
  copyToClipboard(extId, e.target);
});

document.getElementById('copy-cmd').addEventListener('click', (e) => {
  copyToClipboard(installCmd, e.target);
});

// Start annotation button — routes through background script which handles injection
document.getElementById('start-btn')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: "TOGGLE_PICKER" });
  window.close();
});

// Retry button
document.getElementById('retry-btn')?.addEventListener('click', () => {
  checkConnection();
});

// Update UI based on connection state
function setConnected() {
  statusDot.className = 'status-dot connected';
  statusText.textContent = 'Connected';
  setupSection.style.display = 'none';
  readySection.style.display = 'block';
  troubleSection.style.display = 'none';
}

function setNotInstalled(detail) {
  statusDot.className = 'status-dot';
  statusText.textContent = detail || 'Not installed';
  setupSection.style.display = 'block';
  readySection.style.display = 'none';
  troubleSection.style.display = 'none';
}

function setTrouble(error) {
  statusDot.className = 'status-dot trouble';
  statusText.textContent = 'Connection issue';
  setupSection.style.display = 'block';
  readySection.style.display = 'none';
  troubleSection.style.display = 'block';
  document.getElementById('trouble-detail').textContent = error || 'Unknown error';
}

function setChecking() {
  statusDot.className = 'status-dot checking';
  statusText.textContent = 'Checking...';
  // Reset sections to initial state (setup visible, others hidden)
  setupSection.style.display = 'block';
  readySection.style.display = 'none';
  troubleSection.style.display = 'none';
}

// Check connection using the background service worker.
//
// IMPORTANT: Do not call connectNative() directly from the popup.
// Chrome will spawn a *separate* native host process for each connectNative()
// call. That can race with the background's long-lived native connection and
// break /tmp socket/token usage.
function checkConnection() {
  setChecking();
  
  let resolved = false;
  const cleanup = () => {};
  
  const timeout = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      cleanup();
      setTrouble('Timeout - background service worker not responding');
    }
  }, 3000);
  
  try {
    chrome.runtime.sendMessage({ type: 'CHECK_NATIVE_CONNECTION' }, (resp) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      const err = chrome.runtime.lastError?.message;
      if (err) {
        setTrouble(err);
        return;
      }

      if (resp?.connected) {
        setConnected();
        return;
      }

      if (resp?.status === 'not_installed') {
        setNotInstalled(resp?.detail || 'Native host not found');
        return;
      }

      setTrouble(resp?.detail || 'Native host not responding');
    });
    
  } catch (err) {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    cleanup();
    setTrouble(err.message);
  }
}

// Check on load
checkConnection();
