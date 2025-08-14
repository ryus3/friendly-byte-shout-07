#!/bin/bash
# Vite launcher script
node "$(dirname "$0")/../vite/bin/vite.js" --host :: --port 8080 "$@"