#!/bin/bash
echo "🔧 Fixing dependencies for Lovable project..."

# Remove existing node_modules and package-lock.json
echo "📦 Cleaning existing dependencies..."
rm -rf node_modules
rm -f package-lock.json

# Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force

# Install dependencies
echo "⬇️ Installing dependencies..."
npm install

# Verify vite installation
echo "✅ Verifying Vite installation..."
if npm list vite > /dev/null 2>&1; then
    echo "✅ Vite is now installed!"
    echo "🚀 Starting development server..."
    npm run dev
else
    echo "❌ Vite installation failed"
    echo "💡 Try running: npm install vite@latest --save-dev"
fi