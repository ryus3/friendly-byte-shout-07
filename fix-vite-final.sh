#!/bin/bash
echo "🔧 الحل النهائي لمشكلة vite..."

# إعداد PATH
export PATH="./node_modules/.bin:$PATH"

# تشغيل vite مباشرة
if [ -f "./node_modules/vite/bin/vite.js" ]; then
    echo "✅ تشغيل vite مباشرة..."
    exec node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080
else
    echo "✅ تشغيل vite عبر npx..."
    exec npx vite --host 0.0.0.0 --port 8080
fi