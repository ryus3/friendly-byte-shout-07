#!/bin/bash

echo "🚀 Starting Vite development server..."

# Add node_modules/.bin to PATH
export PATH="./node_modules/.bin:$PATH"

# Try multiple approaches to start vite
if command -v vite &> /dev/null; then
    echo "✅ Found vite in PATH"
    vite --host 0.0.0.0 --port 8080
elif [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ Found vite in node_modules/.bin"
    ./node_modules/.bin/vite --host 0.0.0.0 --port 8080
else
    echo "📦 Using npx to run vite"
    npx vite --host 0.0.0.0 --port 8080
fi