

# إصلاح خطأ البناء: Permission Denied

## المشكلة
```
sh: line 1: /dev-server/node_modules/.bin/vite: Permission denied
```

السكربتات في `package.json` تستدعي `vite` مباشرة، لكن الملف التنفيذي في `node_modules/.bin/vite` ليس لديه صلاحيات التنفيذ في بيئة السيرفر.

## الحل
تعديل سطر واحد في `package.json` - استخدام `npx vite` بدلاً من `vite` مباشرة (كما هو موثق في ذاكرة المشروع):

```json
"scripts": {
  "dev": "npx vite@5.4.19",
  "build": "npx vite@5.4.19 build",
  "build:dev": "npx vite@5.4.19 build --mode development"
}
```

هذا يتجاوز مشكلة الصلاحيات ويضمن استخدام نسخة مستقرة من Vite.

## ملاحظة
`package.json` يحتوي على `vite: ^7.1.3` لكن حسب معايير المشروع المحفوظة، النسخة المستقرة هي `5.4.19`. سنستخدمها في `npx` لتجنب مشاكل التوافق.

