#!/bin/bash

echo "🔧 بدء الحل الجذري لمشكلة vite..."

# إعداد المتغيرات
export NODE_ENV=development
export PATH="./node_modules/.bin:$PATH"

# محاولات متعددة
echo "📦 المحاولة 1: npx vite"
if npx vite --version > /dev/null 2>&1; then
    echo "✅ npx يعمل، بدء الخادم..."
    exec npx vite --host 0.0.0.0 --port 8080
fi

echo "📦 المحاولة 2: vite من node_modules"
if [ -f "./node_modules/vite/bin/vite.js" ]; then
    echo "✅ تم العثور على vite.js، بدء الخادم..."
    exec node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080
fi

echo "📦 المحاولة 3: من .bin"
if [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ تم العثور على vite في .bin، بدء الخادم..."
    exec ./node_modules/.bin/vite --host 0.0.0.0 --port 8080
fi

echo "❌ فشل في جميع المحاولات"
exit 1