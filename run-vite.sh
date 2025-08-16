#!/bin/bash
echo "🚀 تشغيل التطبيق..."
ls -la node_modules/.bin/vite && ./node_modules/.bin/vite --host 0.0.0.0 --port 8080 || npx vite --host 0.0.0.0 --port 8080