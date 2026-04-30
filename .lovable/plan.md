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
- ✅ **`@react-pdf/renderer`** — تم! إنشاء `src/components/pdf/LazyPDFDownloadLink.jsx` (wrapper بـ React.lazy + Suspense). استُبدل في 4 ملفات: AccountingPage, EmployeeFinancialCenterPage, InventoryReportsPage, ProfessionalReportsSystem. المكتبة (~500KB) لم تعد تُحمَّل عند فتح صفحة المحاسبة/المخزون — تُحمَّل فقط عند ظهور زر التصدير. **نفس API تماماً** (signature `{({ loading }) => ...}` محفوظ).
- ⏳ `recharts` (5 ملفات) — الدفعة التالية.
- ⏳ `html5-qrcode` (6 ملفات) — الدفعة بعدها.

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
