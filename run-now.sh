#!/bin/bash

echo "🔥 إصلاح نهائي لمشكلة vite..."

# تحديث package.json لاستخدام npx
sed -i 's/"dev": "vite"/"dev": "npx vite --host :: --port 8080 --cors"/' package.json
sed -i 's/"build": "vite build"/"build": "npx vite build"/' package.json

echo "✅ تم تحديث package.json"

# تشغيل المشروع مباشرة
echo "🚀 تشغيل المشروع..."
npx vite --host :: --port 8080 --cors