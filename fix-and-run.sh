#!/bin/bash

echo "🔧 إصلاح نهائي للتطبيق..."

# تشغيل مباشر من node_modules
if [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ تشغيل vite من node_modules..."
    exec ./node_modules/.bin/vite --host :: --port 8080 --force
else
    echo "🔄 تشغيل vite بـ npx..."
    exec npx vite --host :: --port 8080 --force
fi