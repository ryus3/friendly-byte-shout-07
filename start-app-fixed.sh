#!/bin/bash

echo "🔧 Starting app with proper Vite configuration..."

# Remove any cached vite processes
killall node 2>/dev/null || true

# Clear any cached modules
rm -rf node_modules/.vite 2>/dev/null || true

# Start with npx vite directly
echo "🚀 Starting Vite server..."
npx vite --host 0.0.0.0 --port 8080