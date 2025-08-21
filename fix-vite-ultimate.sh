#!/bin/bash

echo "🔧 الحل النهائي الشامل لمشكلة vite..."

# حذف كامل للملفات القديمة
echo "🗑️ حذف الملفات القديمة بالكامل..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock
rm -f pnpm-lock.yaml

# تنظيف npm cache
echo "🧹 تنظيف npm cache..."
npm cache clean --force

# إعادة تثبيت التبعيات
echo "📦 إعادة تثبيت التبعيات..."
npm install --legacy-peer-deps

# التأكد من تثبيت vite بشكل صريح
echo "⚡ تثبيت vite بشكل صريح..."
npm install vite@latest --save-dev --legacy-peer-deps

# إنشاء symbolic link مباشر لـ vite
echo "🔗 إنشاء رابط مباشر لـ vite..."
mkdir -p ./node_modules/.bin
if [ -f "./node_modules/vite/bin/vite.js" ]; then
    ln -sf ../vite/bin/vite.js ./node_modules/.bin/vite
fi

# جعل الملف قابل للتنفيذ
chmod +x ./node_modules/.bin/vite 2>/dev/null || true

echo "✅ تم إصلاح مشكلة vite بنجاح!"
echo "🚀 جرب الآن: npm run dev"