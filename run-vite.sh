#!/bin/bash

# Script to run vite reliably
echo "🔍 البحث عن vite..."

# Check different possible locations
if [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ تم العثور على vite في node_modules/.bin"
    exec ./node_modules/.bin/vite "$@"
elif [ -f "./node_modules/vite/bin/vite.js" ]; then
    echo "✅ تم العثور على vite في node_modules/vite/bin"
    exec node ./node_modules/vite/bin/vite.js "$@"
elif command -v npx >/dev/null 2>&1; then
    echo "⚠️ استخدام npx كبديل"
    exec npx vite "$@"
else
    echo "❌ لم يتم العثور على vite أو npx"
    exit 1
fi