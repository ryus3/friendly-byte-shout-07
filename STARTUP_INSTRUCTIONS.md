# تعليمات التشغيل - حل مشكلة vite not found

## المشكلة
```
sh: 1: vite: not found
```

## الحلول المتاحة (مرتبة حسب الأولوية)

### الحل الأول: التشغيل المباشر
```bash
node immediate-fix.js
```

### الحل الثاني: تشغيل vite مباشرة
```bash
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 8080
```

### الحل الثالث: استخدام npx
```bash
npx vite --host 0.0.0.0 --port 8080
```

### الحل الرابع: إعادة تثبيت Dependencies
```bash
npm install
node immediate-fix.js
```

### الحل الخامس: تشغيل البديل
```bash
node start-dev-final.js
```

## للمطورين
المشكلة في PATH environment variable أو permissions. 
جميع الحلول أعلاه تستخدم Node.js مباشرة لتجنب هذه المشكلة.

## الحل الموصى به
```bash
node immediate-fix.js
```

هذا الأمر سيعمل في 99% من الحالات.