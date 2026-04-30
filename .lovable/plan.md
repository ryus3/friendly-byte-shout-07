
# خطة التسريع الشاملة — آمنة 100%

## الهدف
تحويل الموقع إلى تطبيق سريع كالبرق دون كسر أي وظيفة (الجرد، المشتريات، التليغرام، الإشعارات، Realtime، المالية).

## المبدأ
**لا نمس**: triggers، RLS، التليغرام، AlWaseet/MODON، الحسابات المالية، السبلاش، الإشعارات بقنواتها الثلاث.

---

## المرحلة 1 — تقسيم `getAllData` إلى مرحلتين (الأهم)

**الملف**: `src/api/SuperAPI.js`

### Phase 1 (فوري — قبل ظهور الواجهة):
- `products` (مع variants/inventory)
- `orders` (مع order_items)
- `customers`
- `settings`, `profiles`
- `cashSources`

### Phase 2 (بعد 1.5 ثانية في الخلفية، شفاف للمستخدم):
- `purchases`, `expenses`, `profits`
- `aiOrders`, `profitRules`, `orderDiscounts`
- `customerLoyalty`, `loyaltyTiers`

**النتيجة**: الواجهة تظهر بعد ~1 ثانية بدلاً من 3-8 ثواني. باقي البيانات تصل قبل أن يحتاجها المستخدم.

**الأمان**: نفس البيانات، نفس الشكل النهائي للـ context. الصفحات التي تستخدم purchases/expenses تنتظر Phase 2 تلقائياً (loading state موجود أصلاً).

---

## المرحلة 2 — كاش ذكي للمتغيرات (lookup tables)

**الملفات**: `src/api/SuperAPI.js`, `src/contexts/VariantsContext.jsx`

- `colors`, `sizes`, `categories`, `departments`, `product_types`, `seasons_occasions`
- تُجلب **مرة واحدة** وتُحفظ في `localStorage` لمدة **24 ساعة**
- تُحدّث تلقائياً عند:
  - فتح صفحة "إدارة المتغيرات"
  - فتح صفحة "إضافة منتج"
  - حدث Realtime على الجدول المعني
- إزالة الجلب المكرر في `VariantsContext` (يقرأ من نفس الكاش)

**الأمان الكامل**: لا تأثير على الجرد/المشتريات/الطلبات. هذه أسماء فقط.

---

## المرحلة 3 — تثبيت الجلسة (تسجيل الدخول لا ينتهي)

**الملفات**: `src/integrations/supabase/client.ts`, `src/contexts/UnifiedAuthContext.jsx`

- التحقق من تفعيل `persistSession: true` و `autoRefreshToken: true` و `storage: localStorage`
- إضافة معالج `visibilitychange` يستدعي `supabase.auth.refreshSession()` عند عودة المستخدم للتطبيق
- التأكد من أن `onAuthStateChange` لا يمسح الجلسة عند فقدان الشبكة المؤقت

**النتيجة**: الجلسة تستمر أيام/أسابيع بدون الحاجة لخطة Pro.

---

## المرحلة 4 — فهارس قاعدة البيانات (migration آمن)

```sql
CREATE INDEX IF NOT EXISTS idx_orders_status_changed_at ON orders(status_changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_variant_id ON inventory(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_profits_employee_id ON profits(employee_id);
```

**آمن 100%**: الفهارس تسرّع القراءة فقط، لا تغيّر بيانات.

---

## المرحلة 5 — تأجيل Realtime غير الحرج

**الملف**: `src/api/SuperAPI.js` (دالة `setupRealtimeSubscriptions`)

- القنوات الحرجة (orders, order_items, notifications): تشتغل فوراً
- القنوات الثانوية (expenses, products, inventory, ai_orders): تتأخر 1500ms بعد الإقلاع

**لا ندمج قنوات الإشعارات** (احتراماً لطلبك).

---

## ما لن نلمسه (مضمون)

- ❌ السبلاش (يبقى كما هو)
- ❌ التليغرام (لا تغيير)
- ❌ كلمة "افتراضي" (مؤجلة لخطة منفصلة بعد التأكد من السرعة)
- ❌ RLS / triggers / search_path
- ❌ AlWaseet / MODON
- ❌ الحسابات المالية
- ❌ دمج قنوات الإشعارات الثلاث

---

## الملفات المعدّلة (سأحتفظ بنسخ قابلة للاسترجاع)

1. `src/api/SuperAPI.js` — تقسيم getAllData + كاش lookup
2. `src/contexts/SuperProvider.jsx` — استدعاء phase 1 / phase 2
3. `src/contexts/VariantsContext.jsx` — قراءة من الكاش
4. `src/integrations/supabase/client.ts` — التحقق من persistSession
5. `src/contexts/UnifiedAuthContext.jsx` — معالج visibilitychange
6. **migration جديد** — فهارس فقط

---

## النتيجة المتوقعة

| المقياس | قبل | بعد |
|---------|-----|-----|
| First paint | 3-8 ثانية | < 1.5 ثانية |
| التفاعل الكامل | 5-10 ثانية | 2-3 ثانية |
| تسجيل الدخول | ينتهي بسرعة | يستمر أسابيع |
| الجرد/المالية | ✅ | ✅ بدون تغيير |

---

## أسئلة قبل التنفيذ

1. **مرحلة "افتراضي" → "-"**: هل أؤجلها لخطة منفصلة بعد التأكد من السرعة؟ (موصى به)
2. **الفهارس**: أنفّذها كـ migration؟ (آمنة جداً)
3. **هل أبدأ بالمرحلة 1 فقط** لتقيس السرعة قبل الباقي؟ أم أنفّذ الخمس مراحل دفعة واحدة؟

في انتظار موافقتك.
