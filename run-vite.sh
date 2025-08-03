#!/bin/bash
# حل نهائي لمشكلة vite

if [ -f "./node_modules/vite/bin/vite.js" ]; then
    echo "تشغيل vite من node_modules..."
    exec node ./node_modules/vite/bin/vite.js "$@"
elif [ -f "./node_modules/.bin/vite" ]; then
    echo "تشغيل vite من .bin..."
    exec ./node_modules/.bin/vite "$@"
else
    echo "استخدام npx..."
    exec npx vite "$@"
fi