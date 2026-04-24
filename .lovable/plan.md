

# خطة إصلاح الكارثة — الفاتورة المعلقة لا يجب أن تُكمل الطلبات

## السبب الجذري المؤكد (لا افتراضات)

عند تنفيذ migration الـ backfill (إدراج 12 طلب مفقود في `delivery_invoice_orders` للفاتورة 3247172):
- الـ trigger **`auto_link_dio_to_order`** اشتعل قبل/مع الإدراج وفعل التالي **بدون فحص `received` للفاتورة**:
  ```sql
  UPDATE orders SET receipt_received = true ...
  ```
- ثم triggers الطلبات (`handle_order_status_change` / `auto_create_revenue_movement`) شعّلت سلسلة:
  - `status` انتقل من `delivered` → `completed`
  - 12 حركة نقد `in` تم إنشاؤها

**المشكلة الجوهرية**: `auto_link_dio_to_order` يخلط بين **الربط المنطقي** و**الاستلام المالي**. وهذا انتهاك صريح لـ Completion Gate المسجل في الذاكرة:
> "Order 'completed' status requires delivery_status '4' AND receipt_received = true [from a real received invoice]"

نفس المشكلة موجودة في `sync_order_receipt_on_invoice_link` لكنها تتحقق من `received=true` بشكل صحيح.  
**الجاني الفعلي** = `auto_link_dio_to_order` فقط.

الفاتورة 3247172 الآن `received=false` → 12 طلب يجب أن يكونوا `delivered + receipt_received=false` وليس `completed`.

## الإصلاحات (3 كوارث + إزعاج MODON)

### 1) إصلاح الـ trigger الجذري `auto_link_dio_to_order` (لا تكرار للكارثة أبداً)

تعديل الدالة لتفصل الربط عن الاستلام:
- **يبقى**: ربط `order_id` + كتابة `delivery_partner_invoice_id` (هذا منطقي وآمن)
- **يُحذف نهائياً**: تعليم `receipt_received = true` و `receipt_received_at` و `receipt_received_by`
- منطق الاستلام يبقى **حصرياً** عبر:
  - `sync_orders_on_invoice_received` (يعمل فقط عند `NEW.received=true`)
  - `ensure_all_invoice_orders_received` (يعمل فقط عند `NEW.received=true`)
  - `sync_order_receipt_on_invoice_link` (يفحص `v_is_received=true` قبل التحديث)

النتيجة: الربط المستقبلي لن يُعلّم أي طلب مستلماً ما لم تكن الفاتورة فعلاً `received=true`.

### 2) تنظيف الكارثة الحالية (الفاتورة 3247172)

**migration واحدة دقيقة، آمنة، قابلة للتراجع منطقياً**:

أ) **حذف 12 حركة نقد** أُنشئت خطأً في `2026-04-24 06:20:51.230773+00` للطلبات المرتبطة بالفاتورة 3247172:
- التحقق من معايير صارمة: `created_at` بالضبط + `reference_type='order'` + `reference_id IN (12 IDs محددة)` + `movement_type='in'`
- استخدام `delete_cash_movement_on_return` فلسفة **clean state** (الحركات لم تكن صحيحة أصلاً)

ب) **إعادة 12 طلب**:
- `receipt_received = false`
- `receipt_received_at = NULL`
- `receipt_received_by = NULL`
- `status = 'delivered'` (لأن `delivery_status=4` لا يزال صحيحاً)

ج) **عدم لمس** `delivery_partner_invoice_id` و **عدم حذف** سجلات `delivery_invoice_orders` (الربط المنطقي صحيح ومفيد، فقط الاستلام كان خطأً).

د) **عدم لمس** سجلات `profits` المرتبطة - ستُحدَّث تلقائياً عبر `sync_profit_status_with_receipt` عند إعادة `receipt_received=false`.

### 3) ضمان أن الـ migration لم تُسبب ضرراً في فواتير أخرى

فحص شامل قبل التطبيق: هل أي طلب آخر تأثر في `2026-04-24 06:20:51.230773` بنفس الكارثة عبر فواتير أخرى معلقة؟ (متوقع: لا، لكن سيتم التحقق ضمن الـ migration كـ safety check).

### 4) إزعاج MODON — إخفاء التحذير المتكرر "فشل التجديد التلقائي"

من الصورة: التحذير الأحمر يظهر دائماً عند فتح الواجهة لأن `refresh-delivery-partner-tokens` يفشل بصمت لـ MODON (token منتهي + يتطلب تسجيل دخول يدوي حسب memory `modon-proxy-authentication-requirement`).

التعديل في `src/contexts/AlWaseetContext.jsx`:
- إزالة الـ toast التحذيري التلقائي عند فشل MODON refresh في الخلفية
- إبقاء الإشعار **فقط** عند محاولة المستخدم استخدام MODON فعلياً (مزامنة، فحص فاتورة، إلخ)
- تسجيل الفشل في console فقط، لا UI noise

## ضمانات صارمة (لا تخريب)

| العنصر | الحالة |
|---|---|
| الفواتير القديمة المستلمة فعلاً | ✅ بدون أي تأثير |
| `delivery_invoice_orders` للفاتورة 3247172 | ✅ تبقى الـ 42 سجل (الربط منطقي صحيح) |
| `delivery_partner_invoice_id` للطلبات | ✅ يبقى `3247172` (مفيد للعرض) |
| `link_invoice_orders_to_orders()` | ✅ بدون تعديل (تعمل صحيح) |
| schema الجداول | ✅ بدون تعديل |
| triggers الأخرى للاستلام | ✅ بدون تعديل (تفحص `received=true` صحيحاً) |
| المزامنة الخلفية | ✅ تعمل بنفس الطريقة، لكن آمنة الآن |

## النتيجة النهائية المتوقعة

| العنصر | قبل | بعد |
|---|---|---|
| 12 طلب `status` | completed ❌ | delivered ✅ |
| 12 طلب `receipt_received` | true ❌ | false ✅ |
| 12 حركة نقد كاذبة | موجودة ❌ | محذوفة ✅ |
| 12 سجل profit | invoice_received | pending ✅ (تلقائي) |
| ربط 12 طلب بالفاتورة | موجود ✅ | يبقى موجود ✅ |
| فاتورة 3247172 `received` | false (صحيح) | false (صحيح) ✅ |
| **عند استلام الفاتورة لاحقاً** | — | الـ 12 طلب يصبحون completed تلقائياً عبر `sync_orders_on_invoice_received` ✅ |
| ربط مستقبلي لأي فاتورة معلقة | يُعلّم خطأً مستلماً ❌ | يربط فقط، لا يُعلّم استلاماً ✅ |
| تحذير MODON المزعج | يظهر دائماً ❌ | يظهر فقط عند الاستخدام الفعلي ✅ |

## الملفات المعدّلة

| الملف | التغيير |
|---|---|
| migration جديدة | (1) إصلاح `auto_link_dio_to_order` بإزالة كتابة `receipt_received` (2) تنظيف الـ 12 طلب + 12 حركة نقد للفاتورة 3247172 (3) safety check لفواتير أخرى |
| `src/contexts/AlWaseetContext.jsx` | إخفاء toast فشل تجديد MODON التلقائي + إبقاء التنبيه عند الاستخدام الفعلي فقط |

## السبب التفصيلي للسماح للكارثة

```text
قبل migration الـ backfill:
  - الفاتورة 3247172: dio_count=30, received=false
  - 30 سطر مربوطين بـ order_id لكن الطلبات receipt_received=false (صحيح، لأن الفاتورة معلقة)
  - لاحظ: الـ 30 السابقين دخلوا قبل وجود الـ trigger الكارثي بصيغته الحالية، أو أن auto_link_dio_to_order لم يربطهم لأن order_id كان NULL ولم يجد match

بعد migration الـ backfill:
  - INSERT 12 سطر جديد بـ NEW.order_id = NULL
  - trigger BEFORE INSERT auto_link_dio_to_order يشتغل
  - يجد order_id عبر tracking_number
  - يضع NEW.order_id := v_order_id
  - ثم UPDATE orders SET receipt_received=true (الكارثة ❌)
  - ثم triggers الطلبات تنقل status إلى completed وتنشئ cash_movements

بعد الإصلاح:
  - نفس السيناريو + INSERT
  - trigger يربط فقط (NEW.order_id := v_order_id)
  - لا UPDATE على receipt_received
  - الطلبات تبقى delivered + receipt_received=false (صحيح)
  - عند استلام الفاتورة لاحقاً (received=true) → sync_orders_on_invoice_received يكمل كل شيء تلقائياً ✅
```

