#!/bin/bash
# إصلاح مشكلة vite نهائياً
echo "🔧 إصلاح مشكلة vite..."

# جعل ملف vite قابل للتنفيذ
chmod +x ./vite

# إنشاء رابط مباشر في node_modules/.bin إذا لم يكن موجوداً
if [ ! -f "./node_modules/.bin/vite" ]; then
    echo "🔗 إنشاء رابط vite..."
    mkdir -p ./node_modules/.bin
    ln -sf ../../vite ./node_modules/.bin/vite
fi

echo "✅ تم إصلاح vite بنجاح!"
echo "💡 الآن يمكنك تشغيل: npm run dev"