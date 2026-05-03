# خطة الإصلاح والتسريع — الحالة

## ✅ منفّذ

### إصلاحات حرجة
- **حل خطأ تصدير PDF** (`l.save is not a function`): `await generateInventoryReportPDF(...)` بدل `.save()` يدوي.
- **حل Maximum update depth في الداشبورد**: تثبيت مرجع `supervisedEmployeeIds` في `useUnifiedProfits` (مصفوفة فارغة ثابتة + مفتاح نصي في deps) — كان يسبب re-render لانهائي.
- **خطأ `require` في StockAlertsCard**: استبدال بـ ES6 import.

### السرعة والسلاسة
- إزالة الشاشة السوداء بين الصفحات: `RouteFallback` (Skeleton) بدل خلفية فارغة.
- Prefetch on Pointer-Down: BottomNav + Sidebar.
- سبلاش بشريط حقيقي 0→100% مرتبط بأحداث: `app:auth-ready` (35%), `app:permissions-ready` (65%), `app:dashboard-ready` (95%), `app:data-ready` (100%).
- إزالة `filter: blur` من keyframes (GPU-only الآن).
- إزالة وميض كروت الجرد (animationDelay).
- إزالة pulse من شارة StockAlerts.
- Scroll-to-top موثوق عبر `data-scroll-container`.

### نطاق المدير والصلاحيات
- `PendingDuesDialog` و `ManagerProfitsDialog` يستخدمان `useSupervisedEmployees`.
- StockAlertsCard مفلتر بـ `owner_user_id`.
- Dashboard Total Orders متوافق مع OrdersStats.

### الترجمة والكاش
- أحجام الطلبات في QuickOrder بالعربية.

## 🔜 موصى به للجلسات القادمة (مخاطر عالية — جلسة مخصصة)
- **A. Lazy `recharts`** (5 ملفات تحليلات، ~250KB): React.lazy + Suspense لكل مكون رسم.
- **B. تقسيم SuperProvider.jsx** (3000+ سطر): orders/products/cash/profits providers مستقلة.
- **C. تليغرام: مدن/مناطق حسب الشركة المختارة** (الوسيط vs MODON) — يتطلب تعديل منطق البوت.
- **D. Capacitor mobile readiness**: status-bar, splash, push.

## ما لم يُمَس (Zero Risk)
- لا triggers، لا RLS، لا cash_movements، لا profits، لا منطق المخزون.
