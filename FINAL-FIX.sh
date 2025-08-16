#!/bin/bash

echo "🔧 إصلاح نهائي وفوري"

# تنظيف الكاش
rm -rf node_modules/.vite
rm -rf .vite

# تشغيل مباشر مع npx (لا نحتاج npm run dev)
echo "🚀 تشغيل التطبيق..."
npx vite --host 0.0.0.0 --port 8080 --force --clearScreen false