let nativePort: chrome.runtime.Port | null = null;

function connectNative() {
  nativePort = chrome.runtime.connectNative("com.pi.annotate");
  
  nativePort.onMessage.addListener((msg) => {
    console.log("[pi-annotate] From host:", msg);
    
    // Forward to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        if (msg.type === "START_ANNOTATION" && msg.url) {
          // Check if already on the target URL (no navigation needed)
          if (tabs[0].url === msg.url) {
            chrome.tabs.sendMessage(tabs[0].id, msg);
            return;
          }
          
          // Navigate to URL first
          chrome.tabs.update(tabs[0].id, { url: msg.url }, (tab) => {
            if (!tab?.id) return;
            const targetTabId = tab.id;
            
            // Cleanup function to remove all listeners
            function cleanup() {
              clearTimeout(timeoutId);
              chrome.tabs.onUpdated.removeListener(listener);
              chrome.tabs.onRemoved.removeListener(onRemoved);
            }
            
            // Set up listener with timeout to prevent memory leaks
            const timeoutId = setTimeout(() => {
              cleanup();
            }, 30000); // 30s max wait for page load
            
            function listener(tabId: number, info: chrome.tabs.TabChangeInfo) {
              if (tabId === targetTabId && info.status === "complete") {
                cleanup();
                // Small delay to ensure content script's React app is fully initialized
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, msg);
                }, 100);
              }
            }
            
            function onRemoved(tabId: number) {
              if (tabId === targetTabId) {
                cleanup();
              }
            }
            
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.onRemoved.addListener(onRemoved);
          });
        } else {
          chrome.tabs.sendMessage(tabs[0].id, msg);
        }
      }
    });
  });
  
  nativePort.onDisconnect.addListener(() => {
    console.log("[pi-annotate] Native host disconnected");
    nativePort = null;
    // Reconnect after delay
    setTimeout(connectNative, 1000);
  });
}

// Listen for messages from content script → forward relevant ones to native host
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  console.log("[pi-annotate] From content:", msg);
  
  // Only forward pi-relevant messages, not internal Chrome messages
  const piMessages = ["ANNOTATIONS_COMPLETE", "USER_MESSAGE", "END_CHAT"];
  if (!piMessages.includes(msg.type)) {
    return; // Internal message, don't forward
  }
  
  if (nativePort) {
    nativePort.postMessage(msg);
  } else {
    console.warn("[pi-annotate] No native port, attempting reconnect");
    connectNative();
    // Retry with exponential backoff
    let attempts = 0;
    const maxAttempts = 5;
    const tryPost = () => {
      attempts++;
      if (nativePort) {
        nativePort.postMessage(msg);
      } else if (attempts < maxAttempts) {
        setTimeout(tryPost, 100 * attempts);
      } else {
        console.error("[pi-annotate] Failed to send message after reconnect attempts");
      }
    };
    setTimeout(tryPost, 100);
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-toolbar") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_TOOLBAR" });
      }
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_TOOLBAR" });
  }
});

// Connect on startup
connectNative();
