#!/bin/bash
# حل جذري لمشكلة vite
export NODE_ENV=development
export PATH="./node_modules/.bin:$PATH"

echo "🚀 بدء خادم التطوير..."
echo "📁 مجلد العمل: $(pwd)"

# جرب عدة طرق
if [ -f "./node_modules/.bin/vite" ]; then
    echo "✅ استخدام vite من node_modules"
    ./node_modules/.bin/vite --host :: --port 8080 --cors
elif [ -f "./node_modules/vite/bin/vite.js" ]; then
    echo "✅ استخدام vite.js مباشرة"
    node ./node_modules/vite/bin/vite.js --host :: --port 8080 --cors  
else
    echo "💡 استخدام npx كحل بديل"
    npx vite --host :: --port 8080 --cors
fi