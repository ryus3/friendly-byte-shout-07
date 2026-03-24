
## التشخيص

Do I know what the issue is? نعم.

المشكلة رجعت لكن بصيغة مختلفة، وهذا يؤكد أن السبب **ليس من كود التطبيق** ولا من ميزة "كامل الربح". السبب هو أن بيئة التشغيل نفسها تنزلق أحياناً لتستخدم Toolchain من `/dev-server` بدل شجرة المشروع.

الآن الخطأ يقول:

```text
failed to load config from /dev-server/vite.config.js
Cannot find module './traverseForScope.js'
Require stack:
- /dev-server/node_modules/@babel/traverse/...
```

هذا مهم جداً لأنه يعني أن dev server لم يعد يعمل من نسخة Vite/Babel المحلية الخاصة بالمشروع، بل من بيئة مشتركة في `/dev-server`، وهذه البيئة نفسها ناقصة/غير متسقة.

## لماذا يحدث هذا؟

لأن المشروع ما زال يحتوي على مؤشرات عدم حتمية في التثبيت:

1. يوجد **ملفا lock معاً**:
   - `package-lock.json`
   - `bun.lock`

2. `bun.lock` ما زال **قديم** ويحتوي `npm` كاعتماد:
   - `"npm": "^11.5.2"`

3. `package.json` ما زال غير موحد بالكامل:
   - `vite` ما زال `^5.4.19`
   - `@vitejs/plugin-react` ما زال `^4.3.4`
   - `rollup` ما زال `^4.46.0`
   - لا يوجد `packageManager`
   - أدوات البناء ما زال جزء منها داخل `dependencies` بدل `devDependencies`

4. هناك drift إضافي في نسخة Node:
   - `.nvmrc` = `20.19.1`
   - runtime error يظهر `Node.js v22.21.1`

إذن الانهيار ليس عشوائياً. هو يحصل عندما تُعاد تهيئة البيئة بطريقة مختلفة، فتُحل بعض الحزم من `/dev-server` بدل المشروع، ثم ينهار Vite أو Babel من ملفات داخلية ناقصة.

## المشكلة الحقيقية باختصار

```text
bun.lock + package-lock.json + ranges + no packageManager
                  ↓
تثبيت غير حتمي / resolver غير ثابت
                  ↓
أحياناً يتم تحميل Vite/Babel من /dev-server
                  ↓
ملفات داخلية ناقصة مثل:
- dep-C6uTJdX2.js
- dep-BK3b2jBa.js
- traverseForScope.js
                  ↓
انهيار dev/build
```

## ما سأفعله لحلها جذرياً

### 1) توحيد مدير الحزم نهائياً
اعتماد npm فقط:
- حذف `bun.lock`
- الإبقاء على `package-lock.json` فقط
- إضافة `packageManager` داخل `package.json`

### 2) جعل Toolchain ثابتاً 100%
في `package.json` سأحوّل الأدوات الحساسة إلى نسخ exact:
- `vite: "5.4.19"`
- `@vitejs/plugin-react: "4.3.4"`
- `rollup: "4.46.0"`

وسأنقل أدوات البناء إلى `devDependencies` حيث يلزم، خصوصاً:
- `vite`
- `@vitejs/plugin-react`
- `rollup`
- `postcss`
- `autoprefixer`
- `tailwindcss`
- `terser`
- `esbuild`

### 3) إزالة أي مصدر drift واضح
- التأكد أن `npm` ليس dependency للمشروع
- إبقاء scripts قياسية فقط:
  - `dev: vite`
  - `build: vite build`
  - `build:dev: vite build --mode development`

بدون wrappers أو runners.

### 4) تثبيت مسار Node بشكل أوضح
لن أغير البنية، لكن سأضيف `engines` في `package.json` أو أوحّدها مع `.nvmrc` حتى لا يبقى المشروع معلّقاً بين Node 20 و Node 22.

### 5) عدم لمس `vite.config.js` إلا للضرورة
لا يوجد حتى الآن دليل أن `vite.config.js` نفسه هو سبب المشكلة. الخطأ الحالي سببه تحميل Vite/Babel من مكان خارجي مكسور، لا من config التطبيق.

## الملفات التي سأعدلها

- `package.json`
- `package-lock.json` (إعادة توليد)
- حذف `bun.lock`
- وقد أضيف `engines` أو أضبط `.nvmrc` فقط إذا احتجنا تثبيت مسار Node

## ما الذي لن أفعله
لن أضيف أي ترقيع مثل:
- `run-vite.mjs`
- `vite-start.js`
- `npx vite` كحل دائم
- scripts التفافية
- تعديلات عشوائية على Babel أو Vite internals

## كيف سأتأكد أن الحل فعلاً جذري

لن أعتبر الحل ناجحاً إلا إذا تحقق كله:

1. `vite --port 8080` يعمل بدون أن يحاول القراءة من `/dev-server/node_modules/...`
2. `vite build --mode development` ينجح
3. لا يظهر أي من الأخطاء:
   - `dep-C6uTJdX2.js`
   - `dep-BK3b2jBa.js`
   - `traverseForScope.js`
   - `rollup/dist/es/parseAst.js`
4. تبقى التعديلات التجارية سليمة:
   - "كامل الربح" يبقى موجوداً
   - منطق الأرشيف لا يتأثر
   - لا نكسر التطبيق بحلول مؤقتة

## النتيجة المتوقعة

- منع رجوع انهيار البناء كل مرة
- تثبيت Vite/Babel/Rollup على شجرة واحدة فقط
- منع fallback إلى `/dev-server`
- الحفاظ على النظام بدون ترقيع
- جعل التعديلات التي تضيفها قابلة للعمل والاستمرار بدل أن تضيع بسبب بيئة بناء غير مستقرة
