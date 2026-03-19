#!/bin/bash

# Direct fix for vite PATH issue
export PATH="./node_modules/.bin:$PATH"

# Run vite with explicit path
if [ -f "./node_modules/.bin/vite" ]; then
    echo "🚀 Starting vite server..."
    ./node_modules/.bin/vite --host :: --port 8080
else
    echo "💡 Using npx as fallback..."
    npx vite --host :: --port 8080
fi