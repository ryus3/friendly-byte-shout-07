#!/bin/bash
echo "🔧 تطبيق حل vite النهائي..."

# Copy our fixed package.json
if [ -f "package-fixed.json" ]; then
    cp package-fixed.json package.json
    echo "✅ تم تطبيق package.json محدث"
fi

# Start the development server
echo "🚀 بدء خادم التطوير..."
node vite-start.js