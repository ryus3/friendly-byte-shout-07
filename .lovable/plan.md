
## التشخيص

Do I know what the issue is? نعم.

الانهيار الحالي ليس من كود React ولا من منطق الأرشيف/الأرباح. السبب الحقيقي هو أن بيئة البناء ما زالت غير موحدة بالكامل، ولهذا تظهر أخطاء Vite/Rollup بأشكال مختلفة كل مرة:

- سابقاً: ملف chunk مفقود داخل `project/node_modules/vite/dist/node/chunks/...`
- حالياً: الخطأ صار من `/dev-server/node_modules/vite/dist/node/cli.js` ويحاول استيراد `/dev-server/node_modules/rollup/dist/es/parseAst.js`

وهذا مهم جداً لأنه يعني أن التشغيل لا يعتمد دائماً على نفس نسخة Vite/Rollup الموجودة داخل المشروع.

## ما وجدته فعلاً في المشروع

1. `package.json` الآن بسيط وصحيح من ناحية السكربتات:
   - `"dev": "vite"`
   - `"build": "vite build"`
   - `"build:dev": "vite build --mode development"`

2. الإصدارات الحرجة مثبتة exact حالياً:
   - `vite: "5.4.19"`
   - `@vitejs/plugin-react: "4.3.4"`
   - `rollup: "4.46.0"`

3. لكن ما زال يوجد **ملفا lock معاً**:
   - `package-lock.json`
   - `bun.lock`

4. و`bun.lock` **قديم وغير متوافق** مع `package.json` الحالي:
   - ما زال يحتوي `"npm": "^11.5.2"` رغم أنه لم يعد موجوداً في `package.json`

5. محلياً داخل المشروع ملف Rollup المطلوب **موجود فعلاً**:
   - `node_modules/rollup/dist/es/parseAst.js`

هذا يثبت أن المشكلة ليست “الملف غير موجود في المشروع”، بل أن البيئة أحياناً تشغّل/تركّب سلسلة أدوات مختلفة أو غير متسقة.

## السبب الجذري

```text
bun.lock + package-lock.json
        ↓
اختيار installer / شجرة dependencies بشكل غير حتمي
        ↓
مرات يُستخدم Vite/Rollup من بيئة مختلفة (/dev-server)
أو تُبنى node_modules بشكل ناقص/غير متوافق
        ↓
ERR_MODULE_NOT_FOUND
(dep-C6uTJdX2.js / dep-BK3b2jBa.js / rollup parseAst.js)
```

باختصار: المشكلة هي **dependency drift + mixed installers**، وليس مشكلة منطق أعمال.

## ما سأفعله لحلها جذرياً

### 1) توحيد مدير الحزم نهائياً
اعتماد **npm فقط** كمصدر وحيد للحقيقة:
- حذف `bun.lock`
- الإبقاء على `package-lock.json` فقط
- إضافة `packageManager` داخل `package.json` لتثبيت المسار على npm بشكل صريح

### 2) تنظيف manifest ليكون حتمياً
في `package.json` سأثبت مسار toolchain بشكل واضح ونهائي:
- الإبقاء على النسخ exact الحالية
- نقل أدوات البناء التي لا ينبغي أن تكون runtime إلى `devDependencies` حيث يلزم، خصوصاً:
  - `@vitejs/plugin-react`
  - `rollup`
  - `autoprefixer`
  - `postcss`
  - `tailwindcss`
  - `terser`
- وعدم إضافة أي runner أو wrapper جديد

### 3) إعادة توليد lockfile من الصفر
لأن `bun.lock` و`package-lock.json` حالياً غير متطابقين:
- إعادة توليد `package-lock.json` من شجرة npm النظيفة فقط
- التأكد أن lockfile الجديد لا يحمل آثار `npm` القديمة ولا أي تعارض مع Bun

### 4) الحفاظ على نظام البناء الموحّد
لن ألمس `vite.config.js` إلا إذا ظهر سبب مباشر، لأنه حالياً لا يبدو مصدر الانهيار.
ولن أضيف:
- `run-vite.mjs`
- `vite-start.js`
- أي patch script
- أي تشغيل عبر `npx vite` من خارج المشروع

### 5) حماية التعديلات التجارية الموجودة
لن أغير منطق الأعمال الحالي لأنه موجود فعلاً في السورس:
- `EmployeeFollowUpPage.jsx`: أرشيف التسوية يشمل `no_rule_archived` و`no_rule_settled`
- `ProfitsSummaryPage.jsx`: استبعاد أرباح 0 من “غير مدفوع”
- `DepartmentManagerSettingsPage.jsx`: خيار `كامل الربح`
- `SuperProvider.jsx`: حساب `profit_percentage === 100`

الهدف هو **تثبيت البيئة فقط** لكي تُبنى هذه التعديلات وتظهر فعلياً.

## الملفات التي سأعدلها

- `package.json`
- `package-lock.json`
- حذف `bun.lock`

وقد أعدل فقط إن لزم:
- `.nvmrc` أو `engines` في `package.json` إذا احتجنا تثبيت مسار Node أيضاً، لكن هذا ثانوي وليس أول خطوة

## التحقق بعد التنفيذ

سأعتبر الحل ناجحاً فقط إذا تحقق كله:

1. `vite build --mode development` ينجح
2. `vite --port 8080` ينجح بدون خطأ `/dev-server/node_modules/rollup/dist/es/parseAst.js`
3. لا يظهر خطأ:
   - `dep-C6uTJdX2.js`
   - `dep-BK3b2jBa.js`
   - `rollup/dist/es/parseAst.js`
4. تبقى التعديلات الحالية فعالة:
   - أرشيف التسوية يعرض طلبات الربح الصفري
   - أرباح 0 لا تظهر كمعلّقة للموظف
   - ميزة “كامل الربح” تبقى موجودة
5. لا أستخدم أي ترقيع مؤقت أو wrapper خارج المسار القياسي

## النتيجة المتوقعة

- وقف رجوع انهيار البناء كل عدة ساعات أو في sandbox جديد
- تثبيت Vite/Rollup على شجرة واحدة فقط
- منع البيئة من الانزلاق إلى install مختلف من `/dev-server`
- الحفاظ على النظام الحالي بدون ترقيع
- نشر إصلاحات الأرشيف والأرباح كما هي بدلاً من ضياعها بسبب build unstable
