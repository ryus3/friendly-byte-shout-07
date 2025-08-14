#!/bin/bash
cd "$(dirname "$0")"
chmod +x vite
if [ -f "./node_modules/vite/bin/vite.js" ]; then
    exec node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080
else
    echo "❌ Vite not found, trying alternative..."
    npx vite --host 0.0.0.0 --port 8080
fi