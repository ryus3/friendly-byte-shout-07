#!/bin/bash

echo "🔧 حل نهائي لمشكلة vite not found..."

# حذف node_modules والملفات القديمة
echo "🗑️ حذف الملفات القديمة..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock

# إعادة تثبيت التبعيات
echo "📦 إعادة تثبيت التبعيات..."
npm install

# التأكد من تثبيت vite
echo "⚡ التأكد من تثبيت vite..."
npm install vite@latest --save-dev

# إنشاء رابط vite مباشر
echo "🔗 إنشاء رابط vite..."
chmod +x ./node_modules/.bin/vite
ln -sf ./node_modules/.bin/vite ./vite

echo "✅ تم إصلاح مشكلة vite بنجاح!"
echo "🚀 يمكن الآن تشغيل: npm run dev"