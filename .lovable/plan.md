
## 1) إصلاح وتقوية المزامنة الشاملة (Zero-error + Progress حقيقي)

**المشكلة الحالية:** زر "مزامنة شاملة الآن" في `InvoiceSyncSettings.jsx` يستدعي `smart-invoice-sync` بنداء واحد طويل، ويظهر فقط Spinner بدون نسبة تقدم. لا يوجد بث للمراحل.

**الحل (5 مراحل مرئية مع %):**

- إضافة جدول حالة فوري (Realtime) `sync_progress_events` لبث المراحل:
  ```text
  (run_id, stage, current, total, message, status, updated_at)
  ```
  مع RLS للقراءة فقط للمصادَّق عليهم.
- داخل `smart-invoice-sync` edge function: بعد كل مرحلة (فواتير → طلبات → ربط → تسوية → تنظيف) نُحدِّث الصف المقابل بنسبة التقدم الحقيقية.
- في الواجهة، عند الضغط على "مزامنة شاملة":
  1. إنشاء `run_id` (uuid) ثم استدعاء الـ function بـ `run_id`.
  2. اشتراك Realtime على الصفوف التي تطابق `run_id`.
  3. عرض **Stepper بـ 5 مراحل** + شريط تقدم كلي بنسبة % + Toast علوي عائم (`OrdersSyncProgress` المعاد استخدامه).
  4. زر إلغاء (يضع `status='cancelled'`).

**تحقق نهائي (لا أخطاء):**
- إضافة فحص idempotency لمنع تشغيل مزامنتين متوازيتين (lock في `auto_sync_schedule_settings`).
- في حال فشل أي مرحلة → تسجيل واضح + متابعة باقي المراحل (Soft-fail) + إظهار المرحلة الفاشلة بالأحمر.
- معالجة timeout (إذا لم يصل تحديث خلال 90 ثانية → عرض "تأخر — تابع في الخلفية").

**الملفات المعدّلة:**
- Migration جديدة: جدول `sync_progress_events` + RLS + publication realtime.
- `supabase/functions/smart-invoice-sync/index.ts`: قبول `run_id` وبث 5 مراحل.
- `src/components/settings/InvoiceSyncSettings.jsx`: استبدال زر runFullSync بمنطق Realtime + Stepper.
- مكوّن جديد `src/components/settings/SyncProgressStepper.jsx`.

---

## 2) ثورة تصميمية للوحة التحكم (Bento Grid عالمي)

**الإلهام:** Apple Health · Linear · Vercel Analytics · Arc Browser — توزيع Bento بأحجام مختلفة، حواف زجاجية ناعمة، تدرّجات Midnight Indigo + لمسات ذهبية، حركات micro-interactions أنيقة.

**الأقسام المعاد تصميمها (داخل `ManagerDashboardSection`):**

```text
+--------------------------------------------------+
|  Hero KPI (إيراد اليوم/الشهر، عداد متحرك)        |  ← خانة كبيرة 2x1
+----------------------+---------------------------+
|  المخزون (Donut +    |  آخر الطلبات (Timeline    |
|  تنبيهات حية)        |   أنيق + Avatars)        |
+----------------------+---------------------------+
|  أكثر المنتجات طلباً | المحافظات (خريطة          |
|  (Bar افقي + صور)   |  حرارية عراقية SVG)       |
+----------------------+---------------------------+
|  أفضل الزبائن (قائمة فاخرة برتب ذهبية + شارات)   |
+--------------------------------------------------+
```

**اللغة البصرية الموحَّدة:**
- خلفية: تدرّج Midnight Indigo (`#0a0a1a → #1e1e5a`) مع طبقات Glass (backdrop-blur + border بشفافية 10%).
- بطاقات: `rounded-3xl`, ظل ناعم متعدد الطبقات, hover lift خفيف (`-translate-y-0.5`).
- خط: Space Grotesk للعناوين، DM Sans للأرقام/النصوص (إضافة في `index.html` + `tailwind.config`).
- لمسة Aurora: شعاع متدرّج أعلى Hero KPI بحركة `animate-pulse` بطيئة.
- Micro-animations: عدّاد أرقام (CountUp), دوران بسيط للأيقونات عند hover, fade-in تدريجي للبطاقات.
- جميع الألوان عبر tokens HSL في `index.css` (لا hex مباشر في المكونات).

**المكونات الجديدة/المعاد بناؤها:**
- `src/components/dashboard/HeroRevenueCard.jsx` (Bento كبير + CountUp + Aurora).
- `src/components/dashboard/InventoryDonutCard.jsx` (Donut SVG + تنبيهات).
- `src/components/dashboard/RecentOrdersTimeline.jsx` (بديل أنيق لـ `RecentOrdersCard`).
- `src/components/dashboard/TopProductsBarCard.jsx` (شريط أفقي + صور مصغّرة).
- `src/components/dashboard/ProvincesHeatmapCard.jsx` (SVG العراق + تظليل حراري).
- `src/components/dashboard/TopCustomersLuxuryList.jsx` (قائمة فاخرة برتب).
- `src/components/dashboard/UnifiedDashboard.jsx` و `ManagerDashboardSection.jsx`: تجميعها داخل Bento responsive (grid-cols-1 md:2 lg:4).

**Tokens مضافة في `index.css`:**
```css
--gradient-midnight: linear-gradient(135deg, hsl(240 60% 6%), hsl(245 60% 24%));
--gradient-aurora: linear-gradient(120deg, hsl(245 100% 70%/.4), hsl(280 100% 70%/.3), hsl(190 100% 70%/.3));
--shadow-glass: 0 8px 32px hsl(240 60% 4% / .35), inset 0 1px 0 hsl(0 0% 100% / .06);
--surface-glass: hsl(240 30% 12% / .55);
```

---

## ملخّص الملفات

| المجال | الملف | النوع |
|---|---|---|
| المزامنة | Migration: `sync_progress_events` | جديد |
| المزامنة | `smart-invoice-sync/index.ts` | تعديل |
| المزامنة | `InvoiceSyncSettings.jsx` | تعديل |
| المزامنة | `SyncProgressStepper.jsx` | جديد |
| التصميم | 6 بطاقات Dashboard | جديد |
| التصميم | `UnifiedDashboard.jsx` + `ManagerDashboardSection.jsx` | تعديل |
| التصميم | `index.css` + `tailwind.config.js` | tokens جديدة |

بعد موافقتك أبدأ التنفيذ مباشرة بدون أسئلة إضافية.
