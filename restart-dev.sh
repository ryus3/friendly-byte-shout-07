#!/bin/bash

# Kill any existing vite processes
pkill -f "vite"

# Wait a moment for cleanup
sleep 1

# Reinstall vite if missing
if ! command -v vite &> /dev/null; then
    echo "Installing vite..."
    npm install vite@latest
fi

# Clear cache and restart
rm -rf node_modules/.vite/
npm run dev