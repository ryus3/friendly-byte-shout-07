

## التشخيص النهائي

### مشكلة البناء — السبب الجذري الحقيقي

ملف `.gitignore` **تالف ترميزياً** (يحتوي أحرف null bytes بدل نص UTF-8 عادي). النتيجة:
- Git لا يتجاهل `node_modules/` فعلياً
- ملفات vite الجزئية (cli.js, index.js) مُتتبَّعة في المستودع **بدون مجلد chunks**
- عند البناء، `bun install` يجد ملفات vite موجودة فلا يعيد تثبيتها → الـ chunks مفقودة → خطأ `ERR_MODULE_NOT_FOUND`

هذا يفسر لماذا كل محاولة سابقة فشلت — كنا نكتب ملفات جزئية فوق بعضها بدل ترك مدير الحزم يثبتها بشكل صحيح.

### مشكلة أرشيف التسوية — محلولة بالفعل

الكود الحالي في `EmployeeFollowUpPage.jsx` يتعامل مع `no_rule_archived` بشكل صحيح:
- سطر 573: يستبعدها من القائمة النشطة ويُظهرها فقط عند تفعيل أرشيف التسوية ✓
- سطر 635: `isSettled` يشمل `no_rule_archived` ✓  
- سطر 951: عدّاد الأرشيف يحسبها ✓

## خطة الإصلاح

### الخطوة 1: إصلاح `.gitignore` (السبب الجذري)

إعادة كتابة `.gitignore` بترميز UTF-8 سليم:

```
node_modules/
dist/
.vite/
*.log
.env
.env.local
```

### الخطوة 2: حذف ملفات vite/plugin-react/rolldown المتتبعة

حذف جميع الملفات التي كُتبت يدوياً داخل:
- `node_modules/vite/` (cli.js, index.js, constants.js, index.d.ts, client.mjs, env.mjs, package.json)
- `node_modules/@vitejs/plugin-react/` 
- `node_modules/@rolldown/pluginutils/`
- `node_modules/.vite/`

هذا يسمح لـ `bun install` بتثبيتها بشكل كامل وصحيح (بما فيها مجلد chunks).

### الخطوة 3: التأكد من package.json

إضافة `@vitejs/plugin-react` للـ dependencies (غير موجود حالياً):

```json
"@vitejs/plugin-react": "^4.5.2"
```

### النتيجة المتوقعة

- `.gitignore` يعمل → `node_modules/` لا يُتتبَّع
- `bun install` يثبّت vite كاملاً مع chunks → البناء ينجح
- أرشيف التسوية يعمل بالفعل للطلبات ذات الربح الصفري

