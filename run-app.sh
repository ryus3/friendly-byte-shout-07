#!/bin/bash
echo "🚀 Starting Inventory Management System..."

# Try to run with node directly
if command -v node &> /dev/null; then
    echo "✅ Using node to start dev server"
    node start-dev-server.js
elif command -v npm &> /dev/null; then
    echo "✅ Using npm to start dev server"
    npm run dev
else
    echo "❌ Neither node nor npm found"
    exit 1
fi