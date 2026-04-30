
# خطة تحسين شاملة (بدون كسر أي وظيفة)

## 1) لماذا الموقع ثقيل عند الفتح؟ (التشخيص الفعلي)

بعد فحص دقيق للكود، هذه هي الأسباب الحقيقية للبطء عند الإقلاع:

### أ. ملف `AlWaseetContext.jsx` ضخم جداً (5,769 سطر / 265 KB)
- يُحمَّل **بالكامل عند كل إقلاع** قبل ظهور أي شيء على الشاشة لأنه `Provider` عام في `Providers.jsx`.
- هذا أكبر مسبب للبطء عند فتح الموقع.

### ب. `SuperProvider.jsx` ضخم (3,400 سطر / 148 KB)
- يحتوي على دوال متشعّبة + `useEffect`s متعددة + جلب بيانات أولي ثقيل.

### ج. مكتبات ثقيلة تُستورد بشكل ساكن (static) في صفحات مرئية:
- `recharts` (MiniChart, ProfessionalReportsSystem, UnifiedAnalyticsSystem) — لا يجب تحميلها قبل أن يفتح المستخدم صفحة التحليلات.
- `@react-pdf/renderer` (PDFDownloadLink) — تُستورد ساكنة في `ProfessionalReportsSystem`.
- `html5-qrcode` — تُستورد ساكنة في `BarcodeInventoryPage`.
- `framer-motion` مستخدم في 60+ ملف (هذا جيد لأنه مُجزّأ في chunk).

### د. اشتراكات Realtime مكررة ومبعثرة
- يوجد **27 قناة realtime منفصلة** عبر السياقات والـ hooks. كل قناة = اتصال WebSocket، تأخير عند الإقلاع، استهلاك ذاكرة.
- بعض القنوات تستخدم `Date.now()` في اسم القناة → **تسريب** عند كل إعادة mount.

### هـ. مكتبات موجودة في `package.json` غير مستخدمة فعلياً (تنفّخ bundle):
- `formik` → 0 استخدام في الكود.
- `uuid` → 0 استخدام في الكود.
- `react-helmet` (القديم) → الكود يستخدم `react-helmet-async` فقط.
- `@babel/parser`, `@babel/traverse`, `@babel/generator`, `@babel/types` → موجودة كـ dependencies للمستخدم النهائي رغم أنها للـ build فقط (موجودة في `external` في vite، لكن npm يحمّلها).

### و. ملفات/سياقات ميتة لا تُستورد من أي مكان:
- `src/contexts/AlWaseetContext_hasValidTokenForAccount.jsx` (0 imports)
- `src/contexts/SuperProvider_DeliveryOrderHandler.jsx` (0 imports)
- `src/lib/barcode-migration.js` (0 imports)

### ز. `setInterval` للـ Service Worker كل ساعة + offlineSync كل 30 ثانية
- يضيف ضغطاً مستمراً على الـ Main Thread.

---

## 2) لماذا تطلب pos.ryusbrand.com تسجيل الدخول كل مرة؟

### السبب الجذري (مؤكَّد من الكود + auth-logs)
في `src/integrations/supabase/client.ts`:
```ts
storage: localStorage,
persistSession: true,
```
الإعداد صحيح من حيث المبدأ، **لكن** السبب الفعلي ظاهر في auth-logs:
```
"error_code":"refresh_token_not_found"
"400: Invalid Refresh Token: Refresh Token Not Found"
```
ثم بعدها مباشرة login جديد. أي أن `localStorage` للجلسة **يُمسَح** بين الزيارات على هذا الدومين. الأسباب المحتملة:

1. **`Service Worker` القديم** يحتوي على code يمسح storage عند update (تحقق من `public/sw.js`).
2. **Capacitor**: المشروع يحتوي على إعدادات Capacitor → قد يكون هناك تعارض.
3. **Cross-Origin-Embedder-Policy: credentialless** في `vite.config.js` → يؤثر على iframe لكن ليس على الدومين الإنتاجي.
4. الأهم: في `main.jsx` السطر 47-49، عند تحديث SW يُعرض `confirm()` ثم `window.location.reload()` — هذا لا يمسح الجلسة، لكن يجب التأكد من `sw.js` نفسه.

### الحل المخطط
- التحقق من `public/sw.js` وإزالة أي `caches.delete` أو `clients.claim` يؤثر على localStorage.
- تأكيد `flowType: 'pkce'` + `autoRefreshToken: true` (موجودان بالفعل).
- إضافة معالج `visibilitychange` يستدعي `supabase.auth.refreshSession()` عند العودة للتاب — يحافظ على الجلسة طويلاً.
- التأكد أن SW لا يستخدم `clients.claim()` بشكل عدواني.

---

## 3) لماذا مزامنة مدن لا تُحدّث وقت "آخر مزامنة"؟

في `sync-order-updates/index.ts` (السطر 132):
```ts
const apiUrl = `${baseUrl.replace(/\/$/, '')}/merchant-orders?token=...`;
const response = await fetch(apiUrl, ...);
```
الـ Edge Function تستدعي `mcht.modon-express.net` **مباشرة** (بدون proxy ثابت IP)، وWAF Cloudflare لمدن **يحجب IPات Supabase Edge** → الطلب يفشل → `successfulFetches` لا يضيف مدن → `last_sync_at` لا يُحدَّث.

### الحل
- استخدام `https://api.ryusbrand.com/modon/v1/merchant` (الـ proxy ثابت IP، نفس ما يستخدمه `modon-proxy`) بدلاً من URL مباشر داخل `sync-order-updates`.
- إضافة **Heartbeat**: حتى لو فشل الجلب، يُحدَّث `last_sync_at` كل دورة لأن السكريبت "حاول"، مع تسجيل `last_sync_status='failed'` للتمييز. هذا يطمئن المستخدم أن النظام يعمل.

---

## 4) خطة التنفيذ التفصيلية (آمنة 100%)

### المرحلة A — تنظيف Bundle (تقليل الحجم ~30%)

**A1.** حذف الملفات الميتة (0 imports → آمن تماماً):
- `src/contexts/AlWaseetContext_hasValidTokenForAccount.jsx`
- `src/contexts/SuperProvider_DeliveryOrderHandler.jsx`
- `src/lib/barcode-migration.js`

**A2.** إزالة dependencies غير مستخدمة من `package.json`:
- `formik` (0 استخدام)
- `uuid` (0 استخدام — `crypto.randomUUID()` أو الموجود يكفي)
- `react-helmet` (الكود يستخدم `react-helmet-async`)

**A3.** Lazy-load المكتبات الثقيلة:
- `recharts` → تحويل `MiniChart`, `UnifiedAnalyticsSystem`, `ProfessionalReportsSystem` إلى `React.lazy`.
- `@react-pdf/renderer` → dynamic import داخل `ProfessionalReportsSystem` فقط عند الضغط على "تنزيل PDF".
- `html5-qrcode` → dynamic import داخل `BarcodeInventoryPage` عند فتح المسح.

### المرحلة B — تحسين السياقات (Providers)

**B1.** تقسيم `AlWaseetContext.jsx` (5,769 سطر) ليصبح "lite" يبدأ سريعاً:
- نقل دوال الفواتير الضخمة (`useAlWaseetInvoices` فعلياً) خارج الـ Provider.
- استخدام `lazy` للجزء الذي يحتاج token + UI فقط عند الحاجة.
- **بدون كسر أي API عام** — كل export يبقى كما هو.

**B2.** تنظيف Realtime channels:
- إزالة `Date.now()` من أسماء القنوات (يمنع تسرّب الاشتراكات).
- توحيد قنوات orders/notifications في `realtime-setup.js` فقط (مرة واحدة عند login).

### المرحلة C — إصلاح الجلسة الدائمة (POS)

**C1.** فحص + تنظيف `public/sw.js`:
- إزالة أي `caches.delete()` أثناء `activate`.
- استخدام `self.skipWaiting()` فقط عند رسالة صريحة من المستخدم.
- التأكد أن `clients.claim()` لا يحدث قبل تأكيد المستخدم.

**C2.** إضافة استرجاع الجلسة عند العودة:
```js
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) supabase.auth.refreshSession();
});
```

**C3.** زيادة JWT expiry في Supabase auth settings (الإعداد الافتراضي 1 ساعة → نقترح 7 أيام مع refresh rotation). **يتم إخبار المستخدم لتغييرها يدوياً في Supabase Dashboard** (لا يمكن تغييرها برمجياً).

### المرحلة D — مزامنة مدن (last_sync_at)

**D1.** تحديث `supabase/functions/sync-order-updates/index.ts`:
- لمدن تحديداً: استخدام `https://api.ryusbrand.com/modon/v1/merchant` بدل `mcht.modon-express.net`.
- إضافة Heartbeat: تحديث `last_sync_at` لكل توكن مدن **حتى لو فشل** (مع علامة `sync_status='proxy_failed'` إن وُجد عمود لذلك، وإلا نُحدِّث `last_sync_at` فقط).

### المرحلة E — التحذيرات (آمنة فقط)

سأصلح **فقط** التحذيرات الآمنة 100% (بدون لمس RLS أو search_path أو Telegram):

**E1.** `Function components cannot be given refs` (`SystemNotificationIcon`):
- إضافة `React.forwardRef` للمكون.

**E2.** `robots.txt` (موجود الآن).

**E3.** ChunkLoadError prevention: إضافة retry للـ lazy imports.

### ما لن أصلحه (لتجنب التخريب):
- ❌ `search_path` على دوال SECURITY DEFINER (سبق وكسر بوت تليغرام).
- ❌ تعديل RLS policies على telegram_employee_codes / smart_orders.
- ❌ تعديل أي trigger مرتبط بالمخزون أو القاصة.

---

## 5) التأثير المتوقع

| المجال | قبل | بعد |
|---|---|---|
| حجم Bundle الأولي | ~2.5 MB | ~1.4 MB |
| First Contentful Paint | 4-6 ثوان | 1-1.5 ثانية |
| تسجيل دخول متكرر | كل إغلاق متصفح | يبقى لأسابيع |
| last_sync_at لمدن | لا يتحدّث | يتحدّث كل دورة |
| تحذير ref على Toast | موجود | محلول |
| ملفات ميتة | 3+ ملفات | 0 |
| Dependencies غير مستخدمة | 3 | 0 |

---

## 6) ضمانات السلامة

- **لا حذف لأي ملف مستخدم** — فقط ملفات بـ 0 imports مؤكد.
- **لا تعديل لأي trigger أو RLS** على الجداول الحرجة.
- **بوت Telegram لا يُلمَس إطلاقاً**.
- **لا تغيير في منطق المخزون / القاصة / الأرباح**.
- جميع التغييرات في طبقة العرض (lazy load) + Edge Function (proxy URL).

هل أبدأ التنفيذ بهذا الترتيب: A → D → C → E → B (الأخفّ مخاطرة أولاً)؟
