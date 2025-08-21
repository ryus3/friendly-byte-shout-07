#!/bin/bash
echo "🔧 إصلاح مشكلة vite نهائياً..."

# تنظيف شامل
rm -rf node_modules package-lock.json yarn.lock pnpm-lock.yaml
npm cache clean --force

# إعادة تثبيت dependencies
echo "📦 إعادة تثبيت dependencies..."
npm install --legacy-peer-deps

# التأكد من وجود vite
echo "🔍 التحقق من وجود vite..."
npm list vite || npm i -D vite@latest --legacy-peer-deps

# جعل الملف قابل للتنفيذ
chmod +x ./vite ./run-vite.sh ./fix-vite.sh

echo "✅ تم إصلاح vite بنجاح!"
echo "💡 جرب الآن: npm run dev"