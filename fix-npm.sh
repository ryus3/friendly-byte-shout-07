#!/bin/bash
echo "🔧 إصلاح نهائي لـ npm و vite..."

# تنظيف cache
npm cache clean --force

# إعادة تثبيت node_modules
rm -rf node_modules
npm install

# تشغيل التطبيق بـ npx
echo "🚀 تشغيل التطبيق..."
npx vite --host 0.0.0.0 --port 8080