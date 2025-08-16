#!/bin/bash
echo "🔧 حل نهائي لمشكلة vite..."

# التحقق من وجود node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 تثبيت dependencies..."
    npm install
fi

# التحقق من وجود vite binary
if [ -f "node_modules/.bin/vite" ]; then
    echo "✅ vite موجود، بدء التشغيل..."
    ./node_modules/.bin/vite --host 0.0.0.0 --port 8080
else
    echo "🔄 استخدام npx لتشغيل vite..."
    npx vite --host 0.0.0.0 --port 8080
fi