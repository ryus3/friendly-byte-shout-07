#!/bin/bash
echo "🔄 إعادة تشغيل التطبيق..."

# قتل أي عملية vite قديمة
pkill -f vite || true

# تنظيف الكاش
rm -rf node_modules/.vite || true

# تشغيل مباشر بـ npm
npm run dev