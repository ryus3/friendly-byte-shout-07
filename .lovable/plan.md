# خطة الإصلاح والتسريع — الحالة

## ✅ منفّذ في هذه الجلسة

### 1) إصلاح خطأ تصدير PDF نهائياً
- **السبب الجذري** (مختلف عن التشخيص السابق): `generateInventoryReportPDF` دالة `async` تحفظ الملف داخلياً ولا ترجع شيئاً. لكن المُستدعي في `InventoryPage.jsx` كان يفعل `const doc = generateInventoryReportPDF(...)` ثم `doc.save(...)` على Promise/undefined ⇒ خطأ `l.save is not a function` رغم أن الملف يُحمَّل فعلاً.
- **الحل**: استبدال الاستدعاء بـ `await generateInventoryReportPDF(exportData)` وحذف `doc.save()` المكرر.

### 2) إزالة الشاشة السوداء بين الصفحات
- إنشاء `src/components/ui/RouteFallback.jsx` — Skeleton أنيق (شريط + كروت + قائمة) بدل `<div bg-background>` الفارغ.
- استبدال جميع `Suspense fallback` و loading حالات `ProtectedRoute` بـ `<RouteFallback />`.
- النتيجة: لا شاشة سوداء، تجربة أشبه بالتطبيقات الأصلية.

### 3) Prefetch on Pointer-Down
- BottomNav: زر الرئيسية يستدعي `import('@/pages/Dashboard.jsx')` فور أول لمسة قبل الإفلات.
- Layout sidebar: كل عنصر قائمة يحمّل chunk صفحته فور `onPointerDown` — انتقال شبه فوري للروابط الأكثر استخداماً (Dashboard, Orders, Products, Inventory, Accounting, ...).

### 4) تسريع انتقال السبلاش (تطبيق عالمي)
- خفض الحد الأدنى للسبلاش: 1500ms → **800ms**.
- خفض السقف الصارم: 6000ms → **5000ms**.
- خفض مدة الـ fade: 500ms → **350ms**.
- إزالة `filter: blur` (ثقيل على CPU) من keyframe — الآن `opacity + transform` فقط (GPU-accelerated).
- منحنى iOS-spring: `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Preload chunk الداشبورد فور تركيب السبلاش** ⇒ جاهز قبل بدء الـ fade.

### 5) تخفيف وميض كروت الجرد
- `animationDelay` في `InventoryStats` خُفّض من `100ms × index` إلى `30ms × index` ⇒ ظهور الكروت دفعة واحدة شبه متزامنة بدل cascade مزعج.

### 6) كرت "طلبات الذكاء الاصطناعي = 0"
- **تحققت من DB مباشرة**: جدول `ai_orders` فارغ (0 صفوف).
- "إجمالي الطلبات: 2" يأتي من جدول `orders` (طلبات حقيقية).
- "طلبات الذكاء الاصطناعي" يأتي من `ai_orders` (طلبات تيليجرام/الذكاء قبل الموافقة).
- **الرقمان لا يقيسان نفس الشيء — الـ 0 صحيح ولا يوجد خطأ**.

## 🔜 الخطوة التالية (موصى بها للجلسة القادمة)

### A — Lazy `recharts` (الأثر الأعلى المتبقي ~250KB)
5 ملفات تحليلات. سأطبق نفس نمط `React.lazy` + `Suspense` المستخدم في PDF و QR.

### B — تقسيم `SuperProvider.jsx` (3000+ سطر)
أكبر ملف في المشروع. تقسيمه إلى Providers مستقلة (orders/products/cash/profits) سيقلل re-renders بشكل كبير ويسرّع كل شيء — لكن يحتاج جلسة مخصصة بحذر شديد لأنه يلامس كل الأنظمة.

### C — جاهزية تطبيق الهاتف
- `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/app`, `@capacitor/push-notifications`.
- جلسة مستقلة بعد إكمال تحسينات الويب.

## ما لم يُمَس (Zero Risk)
- لا triggers، لا RLS، لا cash_movements، لا profits.
- لا توقيعات API، لا منطق المخزون/الإرجاع/التسوية.
- التغييرات كلها في طبقة العرض (Frontend Presentation).
