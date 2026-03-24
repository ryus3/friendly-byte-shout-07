
المشكلة الحالية ليست فقط “خطأ بناء” واحد، بل يوجد الآن سببان واضحان يمنعان المعاينة من الظهور:

## ما تأكدت منه
1. `package.json` مكسور حالياً:
   - يوجد `rollup` مرتين داخل `dependencies`
   - مرة `^4.46.0`
   - ومرة `4.34.8`
   - هذا يسبب مباشرة خطأ `Duplicate dependency / DependencyLoop`

2. يوجد خطأ استيراد فعلي داخل التطبيق يمنع dev server من العرض حتى لو انحلّت مشكلة الحزم:
   - الملف `src/components/accounting/SettledDuesDialog.jsx`
   - يستورد:
   ```js
   import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone';
   ```
   - وVite يعرض بوضوح:
   ```text
   Failed to resolve import "date-fns-tz/formatInTimeZone"
   ```
   - نفس النمط موجود أيضاً في:
     - `src/components/shared/EmployeeReceivedProfitsDialog.jsx`
     - `src/components/profits/SettlementInvoiceDialog.jsx`

## جوابي الصريح: هل أنصح بالرجوع لنسخة قديمة؟
ليس كخيار أول.

الرجوع لنسخة كانت تعمل قد يعيد المعاينة مؤقتاً، لكنه غالباً سيضيع إصلاحات أحدث، والمشكلة الحالية تبدو محددة وواضحة وقابلة للإصلاح جذرياً.  
لذلك أنصح أولاً بإصلاح النسخة الحالية، وليس الرجوع، إلا إذا أردت فعلاً التضحية بالتعديلات الأخيرة.

## الخطة الجذرية المقترحة
### 1) تنظيف `package.json` نهائياً
- حذف التكرار الحالي لـ `rollup`
- الإبقاء على نسخة واحدة فقط متوافقة مع الذاكرة المعتمدة للمشروع:
```json
"rollup": "4.46.0"
```
- إبقاء:
```json
"vite": "5.4.19"
"@vitejs/plugin-react": "4.3.4"
"autoprefixer": "10.4.21"
```
- والأفضل نقل أدوات البناء إلى `devDependencies` بدل خلطها مع `dependencies`:
  - `vite`
  - `rollup`
  - `@vitejs/plugin-react`
  - `autoprefixer`
  - `postcss`

### 2) إصلاح الاستيراد المكسور في 3 ملفات
استبدال:
```js
import { formatInTimeZone } from 'date-fns-tz/formatInTimeZone';
```
بصيغة متوافقة مع نسخة المكتبة المثبتة:
```js
import { formatInTimeZone } from 'date-fns-tz';
```
في هذه الملفات:
- `src/components/accounting/SettledDuesDialog.jsx`
- `src/components/shared/EmployeeReceivedProfitsDialog.jsx`
- `src/components/profits/SettlementInvoiceDialog.jsx`

### 3) مراجعة أي استيرادات مشابهة
- فحص جميع استيرادات `date-fns-tz`
- توحيدها على صيغة واحدة متوافقة
- حتى لا يظهر نفس الخطأ في شاشة أخرى بعد إصلاح الأولى

### 4) التحقق بعد الإصلاح
بعد التنفيذ يجب التحقق بهذا الترتيب:
1. `bun install` يمر بدون duplicate/dependency loop
2. `bun x vite@5.4.19 build --mode development` ينجح
3. المعاينة تفتح بدون Vite overlay
4. التأكد أن صفحة متابعة الموظفين ما زالت تعرض أرشيف التسوية والعداد بشكل صحيح

## النتيجة المتوقعة
بعد هذه الخطوات:
- تختفي مشكلة `Duplicate rollup`
- تختفي مشكلة `DependencyLoop`
- تختفي مشكلة `Failed to resolve import date-fns-tz/formatInTimeZone`
- تعود المعاينة للعمل
- يصبح عندنا إصلاح جذري فعلاً، وليس ترقيعاً

## ملاحظة تقنية مهمة
السبب الذي جعل الوضع يبدو “مربك” هو أن هناك طبقتين من الأعطال:
```text
1) عطل حزم/build config
2) عطل import داخل كود الواجهة
```
حتى لو انحلّت الأولى وحدها، ستبقى المعاينة لا تعمل بسبب الثانية. لذلك يجب إصلاح الاثنين معاً في نفس الدفعة.

## ماذا سأعدل عند التنفيذ
- `package.json`
- `src/components/accounting/SettledDuesDialog.jsx`
- `src/components/shared/EmployeeReceivedProfitsDialog.jsx`
- `src/components/profits/SettlementInvoiceDialog.jsx`

## القرار المهني النهائي
- لا أوصي بالرجوع الآن كخيار أول
- أوصي بإصلاح النسخة الحالية فوراً لأن الأسباب واضحة ومحددة
- إذا فشل الإصلاح بعد هذا التنظيف الشامل فقط، وقتها يكون الرجوع لنسخة مستقرة خياراً منطقياً

<lov-actions>
<lov-suggestion message="Test the preview end-to-end after the build fixes to confirm the app loads and the settlement archive appears correctly.">Verify that it works</lov-suggestion>
<lov-suggestion message="Fix the current build issues by cleaning package.json, removing the duplicate rollup dependency, and correcting all date-fns-tz imports to a compatible pattern.">Fix Build Issues Now</lov-suggestion>
<lov-suggestion message="After the build is fixed, verify the employee follow-up page counters and settlement archive entries for zero-profit invoiced orders.">Recheck Settlement Archive</lov-suggestion>
<lov-suggestion message="Audit the project for other fragile imports and duplicated dependencies so the build stays stable long-term.">Audit Dependency Stability</lov-suggestion>
</lov-actions>
