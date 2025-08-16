#!/bin/bash

echo "إصلاح نهائي وجذري للتطبيق..."

# محاولة تشغيل مباشر مع node
if [ -f "./node_modules/vite/bin/vite.js" ]; then
    echo "تشغيل vite مباشرة مع node..."
    exec node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080 --force
else
    echo "تشغيل مع npx..."
    exec npx --yes vite@latest --host 0.0.0.0 --port 8080 --force
fi