

# الخطة - إصلاح ربط الفواتير تلقائياً (الفواتير فقط)

## السبب الجذري المؤكد (لا افتراضات)

من فحص قاعدة البيانات والكود مباشرة:

1. **الفاتورة 3247172**: موجودة في `delivery_invoices` بـ `orders_count=42` لكن `dio_count=0` (لا سجل واحد في `delivery_invoice_orders`).
2. **دالة `link_invoice_orders_to_orders`**: مُصلحة وتعمل، لكن لا يوجد ما تربطه (لأن جدول `delivery_invoice_orders` فارغ لهذه الفاتورة).
3. **السبب الفعلي**: المزامنة الخلفية في `src/hooks/useAlWaseetInvoices.js` تستدعي `smart-invoice-sync` بـ:
   ```js
   sync_orders: false   // ← السطر 207 و 1053
   ```
   فيتم upsert الفاتورة فقط بدون جلب طلباتها → جدول `delivery_invoice_orders` يبقى فارغاً → لا شيء للربط.
4. **smart-invoice-sync** (الخادم): الافتراضي `sync_orders=true` ومنطق جلب طلبات الفاتورة + استدعاء `link_invoice_orders_to_orders` بعد المزامنة موجود ويعمل (السطر 279-340 و 493-540 و 585).
5. **لماذا الفواتير القديمة "تعمل"**: ليس لأنها مرتبطة عبر `delivery_invoice_orders`، بل لأن الطلبات المحلية تحمل `receipt_received=true` و `delivery_partner_invoice_id` من مسار `sync-order-updates` (مسار مختلف). الربط الحقيقي عبر `delivery_invoice_orders` كان معطلاً منذ مدة، لكن لم يلاحَظ لأن الفواتير القديمة كانت `received=true`.

## الإصلاح (دقيق وآمن)

### 1) `src/hooks/useAlWaseetInvoices.js` — تفعيل جلب الطلبات في المزامنة الخلفية
- **السطر 207**: `sync_orders: false` → `sync_orders: true`
- **السطر 1053**: `sync_orders: false` → `sync_orders: true`
- إضافة تعليق يوضح السبب: المزامنة الخلفية يجب أن تُنشئ سجلات `delivery_invoice_orders` لتفعيل الربط التلقائي.

### 2) `supabase/functions/smart-invoice-sync/index.ts` — تمرير حقل `partner` في upsert طلبات الفاتورة
الكود الحالي (السطر 287-297 و 499-511) لا يضع `partner` ضمن سجل `delivery_invoice_orders`. إذا كان العمود موجوداً في الجدول وغير nullable، يفشل upsert بصمت. سأتحقق فعلياً من schema قبل التعديل، فإن لزم سأضيفه.

### 3) إعادة مزامنة الفاتورة 3247172 يدوياً (إصلاح فوري لمرة واحدة)
بعد deploy التغييرات أعلاه:
- استدعاء `smart-invoice-sync` بـ `mode: 'comprehensive'` و `sync_orders: true` و `force_refresh: true` للمستخدم `91484496-b887-44f7-9e5d-be9db5567604` (مالك الفاتورة).
- النتيجة المتوقعة: الفاتورة 3247172 تحصل على 42 سجل في `delivery_invoice_orders` مع `order_id` مربوط للطلبات الموجودة محلياً.
- **بدون فتح الفاتورة من الواجهة**.

## ما لن يتغير (ضمانات صارمة)
- ❌ لا تعديل على schema الفواتير أو الطلبات.
- ❌ لا حذف لأي بيانات.
- ❌ لا تعديل على الفواتير القديمة المستلمة (تبقى تعمل عبر `receipt_received`).
- ❌ لا تعديل على دالة `link_invoice_orders_to_orders` (مُصلحة بالفعل وتعمل).
- ❌ لا تعديل على كاش المدن/المناطق في هذه الدفعة (سنناقشه بعد إصلاح الفواتير كما طلبت).
- ❌ لا تعديل على `AlWaseetContext.jsx` (الـ self-heal الحالي يبقى كطبقة أمان).

## النتائج المتوقعة

| العنصر | قبل | بعد |
|--------|-----|-----|
| فاتورة 3247172 dio_count | 0 | 42 ✅ |
| فاتورة 3247172 linked_count | 0 | 42 (تقريباً، حسب وجود الطلبات المحلية) ✅ |
| فواتير مستقبلية | تُحفظ بدون طلبات | تُحفظ + طلباتها + الربط تلقائياً ✅ |
| الحاجة لفتح الفاتورة من الواجهة | شرط للربط | لم تعد شرطاً ✅ |
| فواتير قديمة مستلمة | تعمل ✅ | تبقى تعمل ✅ |

## الملفات المعدلة
| الملف | التغيير |
|------|--------|
| `src/hooks/useAlWaseetInvoices.js` | سطرين: `sync_orders: true` |
| `supabase/functions/smart-invoice-sync/index.ts` | إضافة `partner` في upsert إن لزم (بعد التحقق من schema) |

## التفاصيل التقنية
```
قبل:
Background sync → invoices only (sync_orders=false)
                 → 0 records in delivery_invoice_orders
                 → link_invoice_orders_to_orders has nothing to link
                 → user must open invoice → self-heal → finally links

بعد:
Background sync → invoices + invoice orders (sync_orders=true)
                 → 42 records in delivery_invoice_orders
                 → link_invoice_orders_to_orders runs once
                 → invoice fully linked, no UI interaction needed
```

