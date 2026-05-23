# خطة الإصلاحات

## 1) إشعارات تغيير حالة الطلب (بدون تكرار)

**الوضع الحالي:**
- في `supabase/functions/sync-order-updates/index.ts` يوجد منطق Dedup صحيح: يبحث عن إشعار `alwaseet_status_change` بنفس `order_id` ويُحدّثه بدل إنشاء واحد جديد.
- لكن في `src/contexts/AlWaseetContext.jsx` (مزامنة الواجهة / زر الهيدر / دخول الصفحات) يتم في عدة مواضع `insert` مباشر لإشعار جديد عند تغيّر `delivery_status` دون نفس منطق التحديث الذي في Edge Function — مما يسبب أحياناً عدم وصول إشعار (لأن نوعه مختلف) أو تكراره.

**التغيير:**
- استخراج دالة موحّدة `upsertStatusChangeNotification(orderId, payload)` في `AlWaseetContext.jsx` تقوم بـ:
  1. البحث عن آخر إشعار `alwaseet_status_change` لنفس `order_id` خلال 7 أيام.
  2. إن وُجد ونفس `delivery_status` → تخطّي.
  3. إن وُجد وحالة مختلفة → `update` للإشعار نفسه (title/message/data/is_read=false/created_at=now).
  4. إن لم يوجد → `insert` جديد.
- ضمان أن **كل** تحديث حالة (الزر الدوار في الهيدر، دخول صفحة الطلبات، دخول متابعة الموظفين، فحص فردي بزر "تحقق الآن"، المزامنة التلقائية الخلفية) يمر عبر هذه الدالة الموحّدة → لا تكرار ولا حالة بلا إشعار.

## 2) المزامنة التلقائية وما يُستبعد منها

**الوضع الحالي مؤكد:**
- `sync-order-updates/index.ts` يستبعد فقط `delivery_status IN (4, 17)`.
- `AlWaseetContext.syncVisibleOrdersBatch` يستبعد نفس الحالتين + الحالات المحلية النهائية `completed`, `returned_in_stock`.
- كل بقية الحالات (1, 2, 3, 21, 23, 24, 25, 26, 27, 28, 31, 32, "تحتاج معالجة"…) **تتزامن**.

**التغيير:**
- إضافة تعليق توثيقي موحّد في الملفّين يحدد القاعدة الذهبية، مع إضافة فحص دفاعي: إذا كان `status='completed' AND receipt_received=true` نتخطّى أيضاً (نهائي محاسبياً).
- لا تغيير في المنطق غير ذلك — الاستبعاد دقيق فعلاً (4 = تم التسليم بانتظار الفاتورة لا يتغير، 17 = راجع للتاجر نهائي).

## 3) التسليم الجزئي: قبول زيادة على المبلغ الأصلي

**المشكلة (الطلب 143197937):**
في `PartialDeliveryDialog.jsx` سطر 154 يوجد:
```
if (finalPrice > originalTotal) { toast(خطأ); return; }
```
حيث `originalTotal = total_amount + delivery_fee` (مثلاً 24,000). عند إدخال 25,000 (مطابق لسعر شركة التوصيل الفعلي) → يرفضه ويبقى السعر 24,000.

**التغيير:**
- إزالة الشرط الذي يرفض `finalPrice > originalTotal`.
- استبدال السقف بقاعدة منطقية: السماح بأن يكون `finalPrice` أكبر من `originalTotal` ويُحتسب الفرق كـ **زيادة** (مثل رسوم توصيل إضافية من شركة التوصيل). يُسجَّل الفرق في حقل `price_adjustment` ضمن `notes` JSON أو في عمود `discount` بقيمة سالبة (إن كان النظام يدعمه) — الأفضل: ترك `discount = 0` واستخدام `final_amount = finalPrice` كما هو، لأن الإيراد المالي يعتمد على `final_amount` فقط.
- إبقاء الحد الأدنى: `finalPrice >= deliveredItemsTotal + deliveryFee` (تحذير وليس رفض، كما هو الآن).
- إظهار شارة "زيادة عن الطلب الأصلي" في بطاقة فرق السعر (موجودة جزئياً سطر 398-410، نوسّعها لتعرض حالة الزيادة عن الأصلي).
- ضمان أن `handlePartialDeliveryFinancials` يستخدم `finalPrice` كإيراد فعلي دون أي تطبيع — فحص سريع للملف `src/utils/partial-delivery-financial-handler.js` وتأكيد ذلك.

## 4) أيقونة احترافية لإشعار "طلب ذكي جديد"

**الوضع الحالي:** يُستخدم `Bot` من lucide-react في `NotificationsPanel.jsx` و `NotificationHandler.jsx` للنوع `new_ai_order` / `ai_order`.

**التغيير:**
- إنشاء مكوّن أيقونة مخصّص `AiOrderIcon.jsx` ضمن `src/components/icons/` يحتوي SVG احترافي متدرّج (gradient بنفسجي → أزرق سماوي) يمثّل دماغاً/شرارة ذكاء (Sparkles + Brain hybrid) مع توهج خفيف.
- استبدال جميع استخدامات `Bot` لنوع `ai_order` / `new_ai_order` في:
  - `src/components/NotificationsPanel.jsx` (سطر 246، 418، 837)
  - `src/components/notifications/NotificationHandler.jsx` (سطر 74)
  - أي ظهور للأيقونة في كرت `AiOrderCard.jsx` إن لزم.
- الأيقونة الجديدة تتجاوب مع الوضع الداكن وتستخدم tokens من نظام التصميم.

## 5) فحص مزامنة الفواتير والربط

**النقاط التي ستُفحص وتُصلَح:**
1. **`useAlWaseetInvoices.js`:**
   - التأكد من أن `fetchInvoices` يجلب فواتير الحساب المشترك للمدير + موظفيه بشكل صحيح (المنطق موجود لكن يقتصر على فواتير المستخدم نفسه؛ للمدير العام يجب جلب فواتير كل التوكنات النشطة).
   - إضافة مسار للمدير العام يجلب من `delivery_invoices` كل الفواتير غير المُعاد ربطها بدلاً من فلترة حسب `owner_user_id` فقط.
2. **`smart-invoice-sync` Edge Function:**
   - مراجعة الـ upsert لمفتاح `(external_id, partner)` للتأكد من عدم تكرار الفواتير وعدم استبدال `received_at` الموجود (قاعدة Idempotent Date Preservation من الذاكرة).
   - تأكيد أن المزامنة تستخدم كل التوكنات النشطة (المدير + مدير القسم + موظفين) وليس فقط توكن المستخدم الحالي.
3. **الربط التلقائي للطلبات بالفواتير (Self-healing):**
   - التحقق من أن `tracking_number` يُستخدم لربط الطلبات بـ `delivery_partner_invoice_id` عند فتح الفاتورة في الواجهة (موجود لكن يحتاج تفعيله أيضاً عند المزامنة الخلفية للفواتير الجديدة).
4. **إشعارات الفواتير:**
   - فصل واضح بين "فاتورة معلّقة" و "فاتورة مُستلمة" (حسب الذاكرة المحفوظة).
   - منع التكرار باستخدام نفس نمط dedup المستخدم في إشعارات الحالة.

## التفاصيل التقنية

**ملفات ستُعدَّل:**
- `src/contexts/AlWaseetContext.jsx` — دالة upsertStatusChangeNotification موحّدة + استبدال كل insert مباشر للإشعار.
- `src/components/orders/PartialDeliveryDialog.jsx` — إزالة سقف `originalTotal` + تحديث رسائل الفرق.
- `src/utils/partial-delivery-financial-handler.js` — فحص فقط (لا تعديل متوقع).
- `src/components/icons/AiOrderIcon.jsx` — جديد.
- `src/components/NotificationsPanel.jsx` + `src/components/notifications/NotificationHandler.jsx` — استخدام الأيقونة الجديدة.
- `src/hooks/useAlWaseetInvoices.js` — توسيع نطاق الجلب للمدير.
- `supabase/functions/smart-invoice-sync/index.ts` — مراجعة upsert واستخدام جميع التوكنات.
- `supabase/functions/sync-order-updates/index.ts` — تعليقات توثيقية + فحص دفاعي إضافي (لا تغيير منطقي جوهري).

**لا تغييرات على قاعدة البيانات** متوقعة — كل التغييرات على مستوى التطبيق و Edge Functions.
