#!/bin/bash
set -e

EXTENSION_ID="$1"
if [ -z "$EXTENSION_ID" ]; then
  echo "Usage: $0 <extension-id>"
  echo "Get the extension ID from chrome://extensions after loading unpacked"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/host.cjs"

chmod +x "$HOST_PATH"

if [[ "$OSTYPE" == "darwin"* ]]; then
  MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else
  MANIFEST_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
fi

mkdir -p "$MANIFEST_DIR"

cat > "$MANIFEST_DIR/com.pi.annotate.json" << EOF
{
  "name": "com.pi.annotate",
  "description": "Pi Annotate native messaging host",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "Installed native host manifest to: $MANIFEST_DIR/com.pi.annotate.json"
echo "Restart Chrome for changes to take effect."
