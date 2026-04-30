# خطة الإصلاح والتسريع — المرحلة التالية

## 1) لماذا تتأخر الكروت بعد السبلاش؟ والحل

السبلاش مرتبط حالياً بحدث `app:dashboard-ready` الذي يُطلَق بعد جاهزية: `inventoryLoading=false` + `loading=false` + `user` + `isAdmin !== undefined`. لكن في المسار الفعلي يحدث:

- شريط السبلاش يكتمل خلال 1.5s مع تأخير 150ms.
- في نفس اللحظة، `Dashboard.jsx` لا يزال ينتظر بيانات (الفواتير/الأرباح/المخزون)، فيرجع `<div bg-background />` فارغ → هذا هو "التحميل البسيط" الذي تراه.
- بعد ذلك تظهر الكروت.

**الحل:**
- إزالة الشرط `!isDashboardReady → bg-background فارغ` نهائياً. عرض **Skeletons** للكروت بدلاً من خلفية فارغة، بحيث يبدو الانتقال طبيعياً.
- جعل الكروت تَرسم بقيم 0/Skeleton أثناء وصول البيانات (بدون انتظار `inventoryLoading`)، فالـ `useMemo` آمن (يرجع 0 افتراضياً).
- الإبقاء على إطلاق `app:dashboard-ready` لكن أبكر: بمجرد توفر `user && isAdmin !== undefined` (بدون انتظار `inventoryLoading`).
- نتيجة: السبلاش يختفي ⇐ كروت بـ Skeleton لجزء من الثانية ⇐ تمتلئ الأرقام بدون أي شاشة فارغة/شفافة.

## 2) الطلبات الذكية لمدير القسم — لحظية أم تحتاج تحديث؟

فحصت `SuperProvider.jsx` (السطور 765–805): الاشتراك الحي على `ai_orders` يعمل لـ INSERT/UPDATE/DELETE ويبث `aiOrderCreated` فوراً. `AiOrdersManager.jsx` يقرأ من `useSuper().aiOrders` ويفلتر لمدير القسم عبر `isAdmin || isDepartmentManager`. **النظام لحظي بالفعل** — لا حاجة لتحديث يدوي.

**التحقق العملي بعد التنفيذ:** أنشئ طلباً ذكياً من حساب موظف تحت إشراف أحمد → يجب أن يظهر في شاشة أحمد خلال أقل من ثانية بدون أي تدخل. سأضيف لوغ خفيف في الواجهة (devLog فقط) لتأكيد الوصول، ثم نزيله.

تحسين إضافي صغير: تأمين أن قناة الـ realtime مشتركة (مفعلة) لـ `ai_orders` على مستوى Postgres (`ALTER PUBLICATION supabase_realtime ADD TABLE ai_orders` — إن لم تكن مضافة سأضيفها في migration).

## 3) المنسدلة في الطلبات الذكية تظهر كل المستخدمين لأحمد — والحل

في `AiOrdersManager.jsx` السطور 246–255 و879–899:
- المنسدلة تَستعمل `allUsers` (كامل قائمة المستخدمين) ثم تفلتر بالأدوار فقط.
- يظهر للمدير العام/سارة/عبدالله/إلخ لأحمد لأنه مدير قسم — وهذا خطأ.

**الحل (دقيق وآمن):**
- استخدام `useSupervisedEmployees` (موجود) داخل `AiOrdersManager.jsx`.
- إذا `isAdmin` ⇒ نُبقي السلوك الحالي (يرى الجميع).
- إذا `isDepartmentManager && !isAdmin` ⇒ نبني `employeesOnly` من `supervisedEmployees` فقط (مع إضافة المدير نفسه `user` كخيار).
- إذا موظف عادي ⇒ المنسدلة لا تُعرض أصلاً (الشرط `(isAdmin || isDepartmentManager)` يُلغيها).
- `visibleOrders` و`baseVisible` يبقيان كما هما — نحن نَفلتر فقط مَن يظهر في المنسدلة، لا منطق الطلبات نفسها.

## 4) ربط بقية خطة التسريع (Phase D continued)

### D3 — Lazy-load للمكتبات الثقيلة (وفر متوقع 30–40%)
- `recharts` → `React.lazy` مع `<Suspense fallback={Skeleton}>` في كل من:
  - `src/components/analytics/UnifiedAnalyticsSystem.jsx`
  - `src/components/analytics/ProfessionalReportsSystem.jsx`
  - `src/components/department/DepartmentStatsCharts.jsx`
- `jspdf` + `AmiriFont` → dynamic `await import('jspdf')` داخل الدوال التي تُولّد PDF (في `src/utils/pdfGenerator.js` ومكونات `src/components/pdf/*`)، بدون كسر التوقيع.
- `@react-pdf/renderer` (للـ PDFs التفاعلية) → `React.lazy` لمكونات `src/components/pdf/*` تُحمَّل فقط عند فتح حوار التقارير.
- `html5-qrcode` → dynamic import داخل `src/pages/BarcodeInventoryPage.jsx` عند تشغيل الكاميرا فقط.

كل تحويل يتم بدون تغيير API الخارجي للمكون.

### D5 — Skeleton للقوائم (إحساس فوري)
- استبدال `<Loader2 />` المركزي في:
  - شاشة OrderList (قائمة الطلبات)
  - شاشة Inventory (قائمة المخزون)
  - شاشة AiOrdersManager قبل وصول البيانات
- استخدام مكون `Skeleton` الموجود (`src/components/ui/skeleton.jsx`) بـ 6 صفوف.

### D6 — جاهزية تطبيق الموبايل
- التحقق من `capacitor.config.ts` و`AndroidManifest.xml` (موجودان).
- تثبيت: `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/status-bar`.
- إعداد `firebase` config في AndroidManifest للإشعارات.
- توثيق خطوات `npx cap sync` للمستخدم.

## 5) ما لن يُمَس
- منطق توريث المنتج/اللون/القياس في `extract_product_items_from_text` (يعمل).
- RLS / triggers / cash_movements / profits.
- توقيعات أي API أو hooks.
- منطق `process_telegram_order` ومنطق التوجيه المالي (`owner_user_id`).

## 6) الملفات المعدّلة

| الملف | التغيير |
|---|---|
| `src/pages/Dashboard.jsx` | إزالة الـ bg فارغ، إطلاق `app:dashboard-ready` أبكر، Skeletons للكروت |
| `src/components/dashboard/AiOrdersManager.jsx` | المنسدلة تستخدم `useSupervisedEmployees` لمدير القسم |
| `src/components/dashboard/StatCard.jsx` (إن لزم) | دعم حالة skeleton |
| `src/components/analytics/*` | dynamic import لـ recharts |
| `src/components/pdf/*`, `src/utils/pdfGenerator.js` | dynamic import لـ jspdf و@react-pdf |
| `src/pages/BarcodeInventoryPage.jsx` | dynamic import لـ html5-qrcode |
| migration | `ALTER PUBLICATION supabase_realtime ADD TABLE ai_orders` (إن لم تكن مضافة) |
| `package.json` | تثبيت Capacitor plugins |

## 7) الاختبارات بعد التنفيذ
1. السبلاش 100% → كروت بـ Skeleton فوراً → تمتلئ الأرقام (لا شاشة فارغة بينهما).
2. حساب أحمد (مدير قسم) → المنسدلة تعرض فقط: أحمد + موظفيه تحت الإشراف.
3. إنشاء طلب ذكي من موظف أحمد → يظهر فوراً عند أحمد بدون refresh.
4. فتح صفحة التقارير المتقدمة → recharts يُحمَّل عند الحاجة فقط (Network tab).
5. فتح صفحة الباركود → الكاميرا تعمل، html5-qrcode يُحمَّل عند الفتح فقط.
6. توليد PDF → لا تأخير على الإقلاع، jspdf يُحمَّل عند الضغط فقط.

هل أبدأ التنفيذ؟
