#!/bin/bash
echo "🔧 إصلاح مشكلة vite..."

# إزالة node_modules/.vite
rm -rf node_modules/.vite

# تثبيت vite عالمياً إذا لم يكن موجوداً
if ! command -v vite &> /dev/null; then
    echo "⬇️ تثبيت vite عالمياً..."
    npm install -g vite
fi

# إعادة تثبيت الحزم
echo "📦 إعادة تثبيت الحزم..."
npm install

# تشغيل المشروع
echo "🚀 تشغيل المشروع..."
npx vite --host 0.0.0.0 --port 8080