
## التشخيص الدقيق

بعد قراءة الكود الفعلي، اكتشفت **السبب الجذري الحقيقي** لكل مشكلة (وليس ما ظننتُه سابقاً):

### 1. لماذا مدن يستلم 19,000 بدل 24,000؟

في `src/components/quick-order/QuickOrderContent.jsx` السطر **1592**:

```js
let finalTotal = subtotal - discount + (activePartner === 'alwaseet' ? deliveryFeeAmount : 0);
```

هذا الشرط يُضيف رسوم التوصيل **فقط للوسيط**، أما لمدن لا يُضاف! فيصبح `finalTotal = 19000`. ثم في السطر **1942** يُرسَل `price: Math.round(finalTotal)` لمدن. وفي `mapToModonFields` لا يجد `final_amount` ولا `total_amount + delivery_fee` داخل `deliveryPayload` (لأنها غير ممررة) فيقع على `fallbackPrice = orderData.price = 19000`.

**هذا هو الخلل الحقيقي** — تعديل `modon-api.js` السابق لم يحلّه لأن المشكلة قبل وصول البيانات إلى `mapToModonFields`.

### 2. لماذا الطلبات لا تظهر فوراً في صفحة الطلبات؟

في `src/contexts/SuperProvider.jsx` السطر **923**: تم حذف معالج `orderCreated` بتعليق "relying solely on realtime INSERT". لكن الـ realtime عبر `superAPI.setupRealtimeSubscriptions` يفعل فقط `invalidate('orders_only')` — لا يُضيف الطلب الجديد إلى الـ React state. ولا يُعاد جلب البيانات تلقائياً. النتيجة: الطلب موجود في DB لكن لا يظهر في الواجهة حتى تحديث يدوي.

### 3. لماذا يظهر خطأ مزامنة الوسيط (errNum:21)؟

من سجلات edge-function: `errNum:21` في `get_merchant_invoices` يعني **"لا توجد فواتير"** (طبيعي 100% عندما لا يوجد فواتير جديدة لدى الشركة)، وليس خطأ token. لكن الكود الحالي في `smart-invoice-sync` يطبعها كـ `⚠️ Skipping token` ثم يحاول تجديد التوكن بدون داع، ويعرضها للمستخدم كأنها خطأ. هذا سلوك طبيعي يُفسَّر كخطأ.

### 4. لماذا وقت المزامنة لا يتغيّر لمدن؟

`last_synced_at` يتم تحديثها فقط داخل `sync-order-updates` لكل طلب موجود. شركة مدن لا توجد لها طلبات → الدالة تنتهي بدون لمس أي صف → الوقت يبقى ثابتاً. الواجهة تعرض "آخر مزامنة 12:07" لأن هذا آخر وقت ظهرت فيه طلبات فعلياً.

### 5. لماذا تحميل المدن/المناطق وأحجام الطلبات لمدن (والإنجليزية)؟

في `QuickOrderContent.jsx` (سطور 738-746): الكود يقرأ من `delivery_partner_packages` بنجاح (cache)، لكن إذا لم تكن هناك صفوف في الجدول لمدن، يقع على `ModonAPI.getCities/getPackageSizes` ويُحمّلها من API. أحجام الطلبات لمدن تأتي بالإنجليزية من API ولا تتم ترجمتها.

---

## الخطة التنفيذية

### A. إصلاح سعر مدن (الأولوية القصوى)

**ملف:** `src/components/quick-order/QuickOrderContent.jsx`

السطر 1592 — إزالة الشرط الانتقائي:
```js
// قبل:
let finalTotal = subtotal - discount + (activePartner === 'alwaseet' ? deliveryFeeAmount : 0);

// بعد:
let finalTotal = subtotal - discount + (activePartner === 'local' ? 0 : deliveryFeeAmount);
```

السطر 1942 — تمرير الحقول الصريحة لمدن حتى لا يعتمد على fallback:
```js
price: Math.round(finalTotal),
total_amount: Math.round(subtotal - discount),
delivery_fee: deliveryFeeAmount,
final_amount: Math.round(finalTotal),
```

النتيجة: مدن سيستلم 24,000 (19,000 + 5,000) تماماً مثل الوسيط.

### B. الظهور الفوري للطلبات بعد الإنشاء

**ملف:** `src/contexts/SuperProvider.jsx` (حول السطر 920-945)

إعادة تفعيل `orderCreated` و `orderUpdated` handlers ليضيف/يحدّث الطلب في `allData.orders` فوراً بدل انتظار refetch:
```js
const handleOrderCreatedFast = (e) => {
  const newOrder = e.detail;
  setAllData(prev => ({
    ...prev,
    orders: [newOrder, ...(prev.orders || []).filter(o => o.id !== newOrder.id)]
  }));
};
window.addEventListener('orderCreated', handleOrderCreatedFast);
```

وداخل `superAPI.setupRealtimeSubscriptions` callback في `SuperProvider`، عند `table === 'orders'` و `payload.eventType === 'INSERT'`: نُضيف `payload.new` مباشرة إلى `allData.orders` بدلاً من invalidate فقط. هذا يضمن الظهور الفوري حتى من جلسات أخرى.

### C. تحديث `last_synced_at` لكل الشركاء (حتى بدون طلبات)

**ملف:** `supabase/functions/sync-order-updates/index.ts`

بعد كل دورة فحص ناجحة لشريك (مدن/الوسيط)، حتى لو ما كان هناك طلبات للتحديث، نسجّل ختماً زمنياً في جدول `delivery_partner_tokens` (عمود `last_synced_at` موجود أصلاً) وفي `delivery_partners_registry`. هكذا الواجهة تعرض وقت آخر فحص فعلي لكل شركة منفصلة.

كذلك سنعرض في `OrderDetailsDialog` آخر مزامنة لشركة الطلب نفسها (وليس وقت تحديث جدولي).

### D. تخفيف ضوضاء سجلات `errNum:21`

**ملف:** `supabase/functions/smart-invoice-sync/index.ts`

عند `errNum === 21` لـ `get_merchant_invoices`: لا نعتبره خطأ token، ولا نحاول تجديد التوكن. نطبع `info` "لا فواتير جديدة" ونكمل بهدوء. (نفس المنطق موجود في `alwaseet-proxy` لكن مفقود من smart sync.)

### E. ترجمة أحجام الطلبات لمدن وتثبيت الـ cache

**ملف:** `src/lib/modon-api.js` + `QuickOrderContent.jsx`

- إضافة قاموس ترجمة بسيط (Small→صغير، Medium→وسط، Large→كبير...) داخل `getPackageSizes`.
- ضمان أن أحجام مدن تُحفَظ في `delivery_partner_packages` بعد أول جلب، حتى لا يُعاد التحميل من API لاحقاً (نفس آلية الوسيط).
- نفس الشيء للمدن: بعد جلبها من API نُدخلها في `cities_cache` مع `delivery_partner='modon'` لتُقرأ من الـ cache في المرات القادمة.

### F. إصلاحات جانبية موجودة في طلباتك السابقة

موجودة بالفعل أو سنُتمّمها:
- زر الرئيسية في `BottomNav` يفعل scroll-to-top حتى لو في نفس الصفحة (تم سابقاً، نتأكد).
- proximity sensor scroll-to-top (تم سابقاً).
- نموذج إضافة شركة قابل للطي (تم سابقاً).
- زر "تحقق الآن" اليدوي يستدعي `sync-order-updates` للطلب الواحد ويحدّث `last_synced_at` — نتأكد أنه يعمل لكلا الشريكين.

---

## ما لن نلمسه

- لن نُصلح الطلب 3248991 (سيُحذف من قِبَلك).
- لن نُغيّر هيكلية قاعدة البيانات أو الـ triggers (السلوك مطابق لـ memories).
- لن نلمس RLS أو صلاحيات.

## الملفات المعدّلة المتوقّعة

1. `src/components/quick-order/QuickOrderContent.jsx` — إصلاح `finalTotal` و payload مدن.
2. `src/contexts/SuperProvider.jsx` — إعادة تفعيل realtime state updates للطلبات.
3. `src/lib/modon-api.js` — ترجمة أحجام + ضمان cache.
4. `supabase/functions/sync-order-updates/index.ts` — تحديث `last_synced_at` لكل شريك.
5. `supabase/functions/smart-invoice-sync/index.ts` — تهدئة `errNum:21`.

## نتيجة متوقّعة

- طلب مدن جديد بنفس الإعدادات سيصل 24,000 بدقة.
- الطلبات تظهر في صفحة المبيعات بنفس اللحظة بدون تحديث.
- "آخر مزامنة" لمدن تتحدّث كل 10 دقائق حتى لو لا طلبات.
- لا تنبيهات/أخطاء حمراء عند عدم وجود فواتير.
- أحجام مدن بالعربية، والمدن/المناطق من cache بدون تحميل متكرر.
