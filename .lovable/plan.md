# خطة الإصلاح والتسريع — الحالة

## ✅ منفّذ في هذه الجلسة
1. **النافذة الشفافة بعد السبلاش** — حُلّت في `src/pages/Dashboard.jsx`:
   - إزالة `<div bg-background />` الفارغ.
   - إطلاق `app:dashboard-ready` بمجرد جاهزية المستخدم والصلاحيات (بدون انتظار `inventoryLoading`).
   - الكروت تظهر فوراً بعد السبلاش وتمتلئ تدريجياً عند وصول البيانات.

2. **منسدلة "عرض الطلبات" في الطلبات الذكية** — حُلّت في `src/components/dashboard/AiOrdersManager.jsx`:
   - استخدام `useSupervisedEmployees`.
   - الأدمن: يرى الجميع.
   - مدير القسم (مثل أحمد): يرى فقط موظفيه تحت الإشراف + نفسه.
   - الموظف العادي: المنسدلة لا تُعرض أصلاً (شرط `isAdmin || isDepartmentManager`).

3. **الطلبات الذكية لحظية لمدير القسم** — تم التحقق:
   - `ai_orders` مُضافة في `supabase_realtime` publication.
   - `SuperProvider.jsx` (السطور 765–805) يستمع لـ INSERT/UPDATE/DELETE ويبث الأحداث فوراً.
   - لا يحتاج تحديث يدوي.

## 🔜 متبقٍّ من Phase D (يحتاج جلسة مخصصة لكل بند)

### D3 — Lazy-load للمكتبات الثقيلة
- ✅ **`@react-pdf/renderer`** — wrapper موحّد `LazyPDFDownloadLink`. مطبّق في 4 ملفات.
- ✅ **`html5-qrcode`** — جميع مكونات الماسح (BarcodeScannerDialog, QROrderScanner) صارت `React.lazy` + render شرطي `{open && <Suspense>...}`. المكتبة لا تُحمَّل إلا عند فتح الماسح فعلياً. مطبّق في: BottomNav, ProductsPage, ManageProductsPage, EmployeeProductsPage, CartDialog, OrdersToolbar, SelectProductForPurchaseDialog.
- ✅ **`jspdf`** — تصحيح named import (`jspdfMod.jsPDF`) بدل `default` لإصلاح خطأ `l.save is not a function` في تصدير تقرير المخزون.
- ⏳ `recharts` (5 ملفات) — الدفعة التالية.

### D5 — Skeletons موحدة
- استبدال `<Loader2 />` بـ Skeleton في OrderList و Inventory.

### D6 — Capacitor plugins
- `@capacitor/camera`, `@capacitor/push-notifications`, `@capacitor/app`, `@capacitor/status-bar`.
- إعداد Firebase config في AndroidManifest.

### Phase E — إشعارات RLS لمالك المنتج
- إشعار أحمد عند طلب فيه منتجه (يعدّل RLS — حساس).

## ما لم يُمَس
- منطق توريث المنتج/اللون/القياس.
- RLS / triggers / cash_movements / profits / process_telegram_order.
- توقيعات أي API.
