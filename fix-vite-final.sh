#!/bin/bash
echo "🔧 تشغيل التطبيق..."

# تحديث package.json
npm pkg set scripts.dev="npx vite --host 0.0.0.0 --port 8080"

echo "✅ تم تحديث package.json - تشغيل التطبيق..."
npm run dev