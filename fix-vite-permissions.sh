#!/bin/bash

echo "🔧 إصلاح صلاحيات vite..."

# جعل الملف قابل للتنفيذ
chmod +x ./vite
chmod +x ./vite-direct.js
chmod +x ./start-dev-final.js

# التأكد من وجود node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 تثبيت node_modules..."
  npm install
fi

# جعل vite في node_modules قابل للتنفيذ
if [ -f "./node_modules/.bin/vite" ]; then
  chmod +x ./node_modules/.bin/vite
fi

if [ -f "./node_modules/vite/bin/vite.js" ]; then
  chmod +x ./node_modules/vite/bin/vite.js
fi

echo "✅ تم إصلاح الصلاحيات"

# تجربة تشغيل vite
echo "🚀 تجربة تشغيل vite..."
./vite --version || echo "❌ ما زال هناك خطأ"