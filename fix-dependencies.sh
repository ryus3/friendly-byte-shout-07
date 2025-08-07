#!/bin/bash

echo "🔧 إصلاح مشكلة vite not found..."

# حذف node_modules والملفات المرتبطة
echo "🗑️ حذف node_modules القديم..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock

# إعادة تثبيت التبعيات
echo "📦 إعادة تثبيت التبعيات..."
npm install

# التحقق من تثبيت vite
echo "✅ التحقق من تثبيت vite..."
npx vite --version

echo "🚀 جاهز للتشغيل!"
echo "يمكنك الآن تشغيل: npm run dev"