

# إصلاح أرشفة الكارثة + توضيح نظام المزامنة الحالي

## أولاً: السبب الجذري للأرشفة (مؤكد من قاعدة البيانات)

الـ12 طلب الآن:
- `status='delivered'` ✅
- `receipt_received=false` ✅
- `cash_movements` محذوفة ✅
- لكن: **`isarchived=true` ❌** و **`profits.settled_at='2026-04-24 06:20:51'` ❌** (بقايا الكارثة الأولى)

عند الكارثة الأصلية (06:20:51):
1. trigger `auto_link_dio_to_order` علّم `receipt_received=true`
2. trigger الطلبات نقل status إلى `completed`
3. trigger الأرباح نقل profit إلى `settled` ووضع `settled_at`
4. trigger `auto_archive_completed_orders` رأى `completed + receipt_received=true` → **`isarchived=true`**

الـrollback السابق أعاد `status` و `receipt_received` و حركات النقد، لكن نسي `isarchived` و `profits.settled_at`.

## ثانياً: الإصلاح (migration واحدة دقيقة)

**تنظيف بقايا الكارثة فقط للفاتورة 3247172** (شروط صارمة لمنع أي تأثير جانبي):

```sql
-- 1) إزالة الأرشفة الخاطئة عن الـ12 طلب
UPDATE orders 
SET isarchived = false, updated_at = now()
WHERE delivery_partner_invoice_id = '3247172'
  AND status = 'delivered'
  AND receipt_received = false
  AND isarchived = true;

-- 2) إعادة profits إلى pending (مسح settled_at الكاذب)
UPDATE profits
SET status = 'pending', settled_at = NULL, updated_at = now()
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE delivery_partner_invoice_id = '3247172'
    AND receipt_received = false
)
AND settled_at = '2026-04-24 06:20:51.230773+00'::timestamptz;
```

**ضمانات**:
- شرط `delivery_partner_invoice_id = '3247172'` يحصر التأثير على هذه الفاتورة فقط
- شرط `receipt_received = false` يحمي أي طلب فعلاً مستلم
- شرط `settled_at = '2026-04-24 06:20:51.230773'` يطابق بصمة الكارثة بالضبط - لا يلمس أي profit آخر
- الـ19 طلب للفاتورة السابقة 3210286 (المستلمة فعلاً) **لن يتأثروا** لأن `receipt_received=true` لهم

## ثالثاً: نظام المزامنة الحالي - شرح كامل

### المسار الموحد الآن

كل المزامنات (خلفية وأمامية) تمر عبر **edge function واحد**: `smart-invoice-sync`.

```text
┌─────────────────────────────────────────────────────────────┐
│  smart-invoice-sync  (المصدر الوحيد للكتابة)              │
├─────────────────────────────────────────────────────────────┤
│  1. fetch invoices من AlWaseet API                          │
│  2. upsert إلى delivery_invoices                            │
│  3. fetch orders لكل فاتورة (مع retry حتى 3 محاولات)        │
│  4. التحقق من اكتمال snapshot (dio_count == orders_count)   │
│  5. upsert إلى delivery_invoice_orders                      │
│     ↓                                                        │
│     trigger: auto_link_dio_to_order                          │
│       → ربط order_id (منطقي فقط)                            │
│       → تحديث delivery_partner_invoice_id (للعرض فقط)       │
│       → ❌ لا يلمس receipt_received إطلاقاً                 │
│  6. استدعاء link_invoice_orders_to_orders() (ضمان إضافي)    │
└─────────────────────────────────────────────────────────────┘
```

### من يستدعي smart-invoice-sync؟

| المسار | متى | sync_orders |
|---|---|---|
| **مزامنة خلفية تلقائية** (الموقع مغلق/مفتوح) | كل فترة عبر `useGlobalInvoiceSync` و `useAlWaseetInvoices.smartBackgroundSync` | ✅ true → تربط الطلبات تلقائياً |
| **فتح صفحة متابعة الموظفين** | مرة واحدة عند الفتح | ✅ true |
| **زر مزامنة يدوي** | عند الضغط | ✅ true |
| **فتح فاتورة في الواجهة** (self-heal) | كطبقة أمان فقط لو dio_count=0 | ✅ true |

### إجابات أسئلتك المباشرة

**س: هل أصبح الربط عالمياً بدون فتح الفاتورة؟**  
✅ **نعم**. المزامنة الخلفية الآن تجلب الفواتير + تجلب طلبات كل فاتورة + تربطها بالطلبات المحلية تلقائياً عبر trigger `auto_link_dio_to_order`. فتح الفاتورة في الواجهة لم يعد شرطاً للربط - يبقى فقط كطبقة self-heal احتياطية.

**س: هل المزامنة عندما يكون الموقع مغلق تربط الطلبات المحلية؟**  
✅ **نعم**. أي مستخدم يفتح أي صفحة → `useGlobalInvoiceSync` يستدعي `smart-invoice-sync` في الخلفية → الفواتير + الطلبات + الربط يحدث تلقائياً. لا حاجة لفتح صفحة الفواتير ولا فتح فاتورة محددة.

**س: ماذا عن استلام الفاتورة (receipt_received)؟**  
- الربط (linking) = آلي وعالمي بدون أي تدخل
- الاستلام (receipt_received=true) = **يحدث حصراً** عندما تنتقل الفاتورة في AlWaseet إلى `received=true`، عندها trigger `sync_orders_on_invoice_received` يُعلّم كل الطلبات المرتبطة كمستلمة ويبدأ سلسلة الإكمال (status=completed، cash_movements، إلخ)

## رابعاً: ضمانات

| العنصر | الحالة |
|---|---|
| 12 طلب isarchived | true ❌ → false ✅ |
| 12 سجل profit | settled (كاذب) → pending ✅ |
| الفاتورة 3210286 (المستلمة فعلاً) | بدون أي تأثير ✅ |
| أي فاتورة أخرى | بدون أي تأثير ✅ |
| triggers | بدون تعديل (مُصلحة في الدفعة السابقة) ✅ |
| schema | بدون تعديل ✅ |
| **عند استلام 3247172 لاحقاً** | الـ12 طلب يكتملون تلقائياً ✅ |

## خامساً: الملف الوحيد المعدّل

| الملف | التغيير |
|---|---|
| migration جديدة | تنظيف `isarchived` و `profits.settled_at` للـ12 طلب فقط (شروط صارمة) |

لا تعديل كود. لا تعديل triggers. لا تعديل edge functions. النظام الحالي للمزامنة سليم بالكامل بعد إصلاحات الدفعات السابقة.

