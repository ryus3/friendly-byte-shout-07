# خطة الإصلاح والتسريع — الحالة

## ✅ منفّذ (هذه الجلسة)

### 🚚 تليغرام: مدن/مناطق حسب الشريك المختار
- خرائط `city_delivery_mappings` و `region_delivery_mappings` تُحمَّل حسب `telegram_bot_delivery_partner`.
- Helpers جديدة `getCityExternalId` / `getRegionExternalId` — استبدلت كل ناتج `alwaseet_id` بمعرّف الشريك الفعلي.
- Fallback آمن إلى `alwaseet_id` فقط عند غياب الخريطة.

### 🏠 الداشبورد
- `RecentOrdersCard`: 3 → **5 طلبات**، **حذف عمود السعر**، عنوان كامل (مدينة/محافظة/عنوان) عبر `ScrollingText` متحرك.
- `TopListCard` (العملاء/المحافظات/المنتجات): سقف العرض **5 عناصر** ضمن الكرت.

### ⚡ Lazy `recharts` (~250KB من bundle الداشبورد)
- `MiniChart` → wrapper `React.lazy` يحمّل `MiniChartImpl` عند الحاجة فقط مع skeleton.

### 📱 أفكار عالمية مُفعّلة
- **Pull-to-Refresh**: `usePullToRefresh` + `PullToRefreshIndicator` على مستوى Layout — يبثّ `app:pull-to-refresh` لتعيد الصفحات الجلب.
- مؤشّر يظهر فقط على شاشات اللمس (لا يزعج الديسكتوب).

### 🛠 إصلاحات حرجة سابقة
- حلقة Maximum update depth في `useUnifiedProfits` (مرجع مصفوفة supervised ثابت).
- خطأ `require` في StockAlertsCard.
- خطأ `l.save` في تصدير PDF.
- إزالة الشاشة السوداء بين الصفحات (RouteFallback).
- سبلاش بشريط حقيقي 0→100%.
- إزالة وميض كروت الجرد و StockAlerts pulse.
- نطاق المدير في PendingDuesDialog/ManagerProfitsDialog/StockAlerts.

## 🔜 موصى به (جلسة لاحقة، عالي المخاطر)
- **إيقاف إشعارات DB المكررة**: حذف trigger `notify_order_status_change` + dedup داخل edge function (يحتاج فحص الـ trigger الحالي ومنع كسر التدفق).
- **تقسيم SuperProvider.jsx** (3000+ سطر).
- **Confetti** على إكمال الطلب (يحتاج dynamic import لـ canvas-confetti).
- **Live feed** في الداشبورد (realtime channel جديد).
- **Capacitor mobile readiness**.

## ما لم يُمَس (Zero Risk)
- لا triggers، لا RLS، لا cash_movements، لا profits، لا منطق المخزون.
