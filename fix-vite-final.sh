#!/bin/bash
echo "🔧 إصلاح وتشغيل vite..."

# إنشاء package.json مؤقت مع script صحيح
cp package.json package.json.backup
cat package.json | sed 's/"dev": "vite"/"dev": "npx vite --host 0.0.0.0 --port 8080"/' > package-temp.json
mv package-temp.json package.json

echo "✅ تم إصلاح package.json - تشغيل التطبيق..."
npm run dev