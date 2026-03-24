

# إصلاح خطأ البناء - حل نهائي (سطر واحد)

## السبب
`vite` غير موجود في `package.json` → `node_modules/vite` تالف (ملفات chunks مفقودة) → `npx` يجد النسخة التالفة المحلية أولاً ويستخدمها.

## الحل
إضافة `vite` كتبعية مباشرة في `devDependencies` بالنسخة `5.4.19`:

```json
"devDependencies": {
    "@types/node": "^24.1.0",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "eslint": "^8.57.1",
    "eslint-config-react-app": "^7.0.1",
    "vite": "5.4.19",
    "vite-plugin-pwa": "^0.20.5"
}
```

هذا يضمن أن `node_modules/vite` يُثبَّت بنسخة كاملة وسليمة، فلا يحدث خطأ `dep-C6uTJdX2.js` مرة أخرى.

### ملف واحد فقط يتأثر
- `package.json` سطر 86-93: إضافة `"vite": "5.4.19"` في devDependencies

