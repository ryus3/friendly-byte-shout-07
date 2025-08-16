#!/bin/bash
echo "🔧 إصلاح شامل لمشكلة vite..."

# إزالة cache
rm -rf node_modules/.vite
rm -rf node_modules/.cache

# تحديث package.json لاستخدام npx
if [ -f package.json ]; then
    echo "📝 تحديث scripts في package.json..."
    sed -i 's/"dev": "vite"/"dev": "npx vite --host :: --port 8080"/' package.json
    sed -i 's/"build": "vite build"/"build": "npx vite build"/' package.json
fi

# إعادة تثبيت vite محلياً
echo "📦 إعادة تثبيت vite..."
npm install vite@latest --save-dev

# تشغيل التطبيق
echo "🚀 تشغيل التطبيق..."
npm run dev