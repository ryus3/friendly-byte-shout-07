#!/bin/bash
echo "🔧 الحل النهائي لمشكلة vite..."

# Create a temporary package.json with correct script
cp package.json package.json.backup
sed 's/"dev": "vite"/"dev": "npx vite --host 0.0.0.0 --port 8080"/' package.json > package.json.tmp
mv package.json.tmp package.json

echo "✅ تم تعديل package.json - يمكنك الآن تشغيل: npm run dev"
echo "🔄 استعادة package.json الأصلي: mv package.json.backup package.json"