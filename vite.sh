#!/bin/bash
echo "🔧 تشغيل vite بشكل مباشر..."
npm run build:dev && npm run preview || npx --yes vite@latest --host 0.0.0.0 --port 8080