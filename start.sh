#!/bin/bash

echo "🚀 تشغيل الخادم..."

# تأكد من إضافة node_modules/.bin إلى PATH
export PATH="./node_modules/.bin:$PATH"

# تحقق من وجود vite
if [ ! -f "./node_modules/.bin/vite" ]; then
    echo "❌ vite غير موجود، إعادة تثبيت..."
    npm install
fi

# تشغيل vite بطريقة مباشرة
if [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ تشغيل vite..."
    exec ./node_modules/.bin/vite --host 0.0.0.0 --port 8080
else
    echo "❌ محاولة مع npx..."
    exec npx vite --host 0.0.0.0 --port 8080
fi