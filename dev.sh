#!/bin/bash

echo "🚀 بدء خادم التطوير..."

# تعيين متغيرات البيئة
export NODE_ENV=development
export PATH="$PWD/node_modules/.bin:$PATH"

# تحقق من وجود node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 تثبيت التبعيات..."
    npm install || { echo "❌ فشل في تثبيت التبعيات"; exit 1; }
fi

# تحقق من وجود vite
if [ ! -f "node_modules/.bin/vite" ]; then
    echo "🔧 إعادة تثبيت vite..."
    npm install vite@latest --save-dev
fi

# تشغيل الخادم
echo "✅ تشغيل الخادم على localhost:8080"

# محاولة متعددة لتشغيل vite
if command -v ./node_modules/.bin/vite &> /dev/null; then
    ./node_modules/.bin/vite --host 0.0.0.0 --port 8080
elif command -v npx &> /dev/null; then
    npx vite --host 0.0.0.0 --port 8080
elif [ -f "node_modules/vite/bin/vite.js" ]; then
    node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080
else
    echo "❌ لا يمكن العثور على vite"
    echo "حاول تشغيل: npm install && npm run dev"
    exit 1
fi