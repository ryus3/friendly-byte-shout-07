
## ما الذي يعنيه الرجوع لنسخة تعمل؟
الرجوع لنسخة تعمل جيد كإيقاف نزيف، لكنه **لا يمنع رجوع الخطأ** إذا بقيت ملفات البناء نفسها غير موحّدة. المشكلة المتكررة ليست من منطق التطبيق، بل من **بيئة الحزم**.

## ما وجدته الآن في النسخة الحالية
1. ما زال يوجد **ملفان lock معاً**:
   - `package-lock.json`
   - `bun.lock`

2. `bun.lock` ما زال **قديماً وغير متطابق** مع `package.json` الحالي، وفيه أثر dependency محذوف سابقاً:
   - `"npm": "^11.5.2"`

3. `package.json` ما زال بلا عناصر التثبيت الحتمي:
   - لا يوجد `packageManager`
   - لا يوجد `engines`
   - لا يوجد `overrides`

4. أدوات البناء ما زال جزء كبير منها داخل `dependencies` بدل `devDependencies` مثل:
   - `@vitejs/plugin-react`
   - `autoprefixer`
   - `esbuild`
   - `postcss`
   - `rollup`
   - `tailwindcss`
   - `terser`

5. الخطأ الحالي يثبت أن Vite أحياناً يُحمَّل من خارج المشروع:
```text
/dev-server/node_modules/vite/dist/node/cli.js
→ يحاول استيراد /dev-server/node_modules/rollup/dist/es/parseAst.js
```
وهذا يعني أن البيئة تنزلق أحياناً إلى toolchain خارجي بدل الاعتماد الكامل على شجرة المشروع.

## السبب الجذري
النسخة التي رجعت إليها قد تكون سليمة في الكود، لكن **الـ manifests ليست محصنة**. لذلك عند أي إعادة تثبيت أو sandbox جديد:
```text
bun.lock + package-lock.json + تبعيات بناء غير منظّمة
→ شجرة dependencies غير حتمية
→ أحياناً local vite ناقص / وأحياناً dev-server يستعمل vite خارجي
→ ERR_MODULE_NOT_FOUND
```

## الخطة الجذرية بعد الرجوع
### 1) توحيد مدير الحزم نهائياً
- حذف `bun.lock`
- اعتماد `package-lock.json` فقط
- إضافة `packageManager` في `package.json` لتثبيت npm كمسار وحيد

### 2) جعل toolchain حتمياً
في `package.json`:
- إبقاء الإصدارات الحساسة exact بدون `^`:
  - `vite: "5.4.19"`
  - `@vitejs/plugin-react: "4.3.4"`
  - `rollup: "4.46.0"`
  - `tailwindcss: "3.4.18"`
  - `autoprefixer: "10.4.21"`
- إضافة `engines` لتثبيت نسخة Node/NPM المتوقعة
- إضافة `overrides` للتبعيات الحساسة العابرة إذا لزم

### 3) فصل runtime عن build-time
نقل أدوات البناء إلى `devDependencies`:
- `@vitejs/plugin-react`
- `rollup`
- `postcss`
- `tailwindcss`
- `autoprefixer`
- `terser`
- `esbuild`

والإبقاء على Dependencies التشغيلية فقط في `dependencies`.

### 4) إعادة توليد lockfile من شجرة واحدة نظيفة
بعد تنظيف `package.json`:
- إعادة توليد `package-lock.json` من npm فقط
- عدم إبقاء أي أثر لـ Bun أو dependencies قديمة

### 5) عدم استخدام أي ترقيع
لن أضيف:
- wrappers
- runners
- patch scripts
- تشغيلات التفافية لـ Vite

الحل سيكون على مستوى:
- `package.json`
- `package-lock.json`
- حذف `bun.lock`

## لماذا هذا يمنع تكرار المشكلة؟
لأن الرجوع لنسخة تعمل يصلح **اللحظة الحالية فقط**، أما توحيد المانيفستات فيصلح **كل إعادة تثبيت مستقبلية**. الهدف أن أي sandbox جديد يبني نفس الشجرة تماماً، فلا يعود:
- `dep-C6uTJdX2.js`
- `dep-BK3b2jBa.js`
- `rollup/dist/es/parseAst.js`

## التحقق الذي سأعتمد عليه بعد التنفيذ
لن أعتبر العمل منتهياً إلا إذا تحقق كله:
1. `vite build --mode development` ينجح
2. `vite --port 8080` ينجح
3. لا يعود أي استيراد من `/dev-server/node_modules/vite/...`
4. تبقى النسخة التي رجعت لها تعمل كما هي بدون كسر منطق التطبيق
5. التحقق من التطبيق نفسه بعد الإقلاع، وليس فقط تعديل الملفات

## الملفات التي يجب تثبيتها الآن
- `package.json`
- `package-lock.json`
- حذف `bun.lock`

## النتيجة المتوقعة
- تمنع تكرار الانهيار بعد ساعات أو بعد rollback أو sandbox جديد
- تبقي المشروع على npm/Vite القياسي فقط
- تمنع الانزلاق إلى Vite/Rollup من `/dev-server`
- تحافظ على النظام بدون ترقيع مؤقت
