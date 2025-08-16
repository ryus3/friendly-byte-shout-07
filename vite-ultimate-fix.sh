#!/bin/bash

# Ultimate fix for persistent vite not found error
echo "🔧 Ultimate vite fix starting..."

# Method 1: Copy package-override to package.json if it exists
if [ -f "package-override.json" ]; then
    echo "📝 Applying package override..."
    cp package-override.json package.json
    echo "✅ Package override applied"
fi

# Method 2: Direct vite execution with multiple fallbacks
echo "🚀 Starting vite server..."

# Try direct node execution first
if [ -f "node_modules/vite/bin/vite.js" ]; then
    echo "✅ Using direct node execution"
    exec node node_modules/vite/bin/vite.js --host :: --port 8080
fi

# Try .bin directory
if [ -f "node_modules/.bin/vite" ]; then
    echo "✅ Using .bin directory"
    exec ./node_modules/.bin/vite --host :: --port 8080
fi

# Try npx with full path
export PATH="./node_modules/.bin:$PATH"
echo "✅ Using npx with PATH"
exec npx vite --host :: --port 8080