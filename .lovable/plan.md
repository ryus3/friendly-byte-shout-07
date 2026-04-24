

# خطة آمنة لإكمال snapshot الفاتورة 3247172 وضمان عدم تكرار النقص

## الحقائق الفعلية المؤكدة الآن (لا افتراض)

| البند | القيمة |
|---|---|
| الفاتورة 3247172 — `orders_count` من API | 42 |
| `dio_count` المحفوظ فعلياً | **30 فقط** |
| `linked_count` | 0 |
| الطلب `138385901` محلياً | موجود (`tracking_number=138385901`, `delivery_status=4`) |
| الطلب `138385901` داخل snapshot الفاتورة | **غير موجود إطلاقاً** |
| آخر external_order_id في snapshot | 138764956 (متجاوز 138385901 رقمياً، أي الترتيب ليس مشكلة) |

**السبب الجذري**: آخر استدعاء لـ `get_merchant_invoice_orders?invoice_id=3247172` رجع 30 طلب فقط بدل 42. ربما API قطعت الرد، أو rate-limit جزئي، أو الفاتورة ما زالت تتحدث على جانب الوسيط. دالة الربط `link_invoice_orders_to_orders` صحيحة وتطابق عبر `tracking_number` و `delivery_partner_order_id` — لكنها لا تستطيع ربط ما هو غير موجود في snapshot.

**الفاتورة السابقة 3210286**: snapshotها 60 سطر (أكثر من orders_count=57)، لذلك كان لديها كل ما يلزم للربط. لم تكن “سحرية”.

## ما لن أمسّه إطلاقاً (ضمان عدم التخريب)

| المسار | الحالة |
|---|---|
| `useAlWaseetInvoices.smartBackgroundSync` (مزامنة الخلفية) | **يبقى كما هو** |
| `AlWaseetContext` self-heal عند فتح الفاتورة | **يبقى كما هو** |
| `useEmployeeInvoices` | **يبقى كما هو** |
| دالة `link_invoice_orders_to_orders` | **يبقى كما هو** (تعمل بشكل صحيح) |
| Trigger `auto_link_dio_to_order` | **يبقى كما هو** |
| schema جداول `delivery_invoices` و `delivery_invoice_orders` و `orders` | **بدون تعديل** |
| السطور الـ 30 الموجودة حالياً في snapshot | **بدون حذف، بدون استبدال** |
| الفواتير القديمة المستلمة | **بدون أي تأثير** |

## ما سأبنيه (تعديل واحد دقيق + إجراءان)

### 1) تعديل واحد فقط في `supabase/functions/smart-invoice-sync/index.ts`

إضافة **تحقق اكتمال + إعادة محاولة واحدة** بعد upsert طلبات الفاتورة، فقط للفواتير غير المستلمة:

```
بعد حلقة upsert الطلبات:
  count_dio = SELECT COUNT(*) FROM delivery_invoice_orders WHERE invoice_id = X
  expected  = invoice.orders_count من API
  
  إذا count_dio < expected:
    انتظر 3 ثواني (تجنب rate-limit)
    استدعِ get_merchant_invoice_orders مرة ثانية
    upsert الفروقات فقط (نفس onConflict الموجود → idempotent)
    سجّل في log: "completion retry: was=X, now=Y, expected=Z"
  
  استدعِ link_invoice_orders_to_orders() مرة واحدة في النهاية
```

- `upsert` بـ `onConflict: invoice_id,external_order_id` يعني السطور الموجودة لن تتكرر ولن تُحذف
- لن يتم استبدال أي شيء، فقط إضافة المفقود
- إذا API رجعت نفس الـ 30 مرة ثانية → لا ضرر، لا تكرار، يُسجّل في log فقط
- إذا رجعت 42 → اكتمل snapshot وتمّ الربط تلقائياً

### 2) إجراء فوري لمرة واحدة على الفاتورة 3247172

استدعاء `smart-invoice-sync` بـ `mode='comprehensive', sync_orders=true, force_refresh=true` مع filter داخلي للفاتورة 3247172 فقط (عبر `existing` check). النتيجة المتوقعة:
- إذا API ترجع كامل الـ 42 الآن → تكتمل snapshot، يُربط 14 طلب محلي تلقائياً (منها 138385901)
- إذا API ما زالت ترجع 30 → نعرف بدقة أن المشكلة عند الوسيط وليست في كودنا، ونرى ذلك في logs

### 3) لا تغيير في تردد المزامنة ولا في عدد المسارات

المزامنة الخلفية ومزامنة الواجهة كلاهما يستدعيان نفس `smart-invoice-sync` Edge Function. التعديل في الـ Edge Function وحدها يفيد كلا المسارين دون تغيير سلوكهما الخارجي.

## النتيجة

| العنصر | قبل | بعد |
|---|---|---|
| 3247172 dio_count | 30 | 42 (إذا API ترسلها) ✅ |
| الطلب 138385901 مرتبط | ❌ | ✅ (إذا API ترجعه ضمن الفاتورة) |
| الفواتير المستقبلية الناقصة | تبقى ناقصة | تكتمل تلقائياً عبر retry واحد ✅ |
| المزامنة الخلفية | تعمل | تعمل بنفس الطريقة + اكتمال أفضل ✅ |
| المزامنة عند فتح الفاتورة | تعمل | تعمل بنفس الطريقة (self-heal كطبقة أمان) ✅ |
| الفواتير المستلمة | تعمل عبر receipt_received | بلا تأثير ✅ |

## الملف الوحيد المعدّل

```
supabase/functions/smart-invoice-sync/index.ts
  + تحقق اكتمال snapshot + إعادة محاولة واحدة (~25 سطر، بعد السطر 534 وبعد السطر 297)
```

لا migration. لا تعديل واجهة. لا تعديل hooks.

## التفاصيل التقنية

```text
المشكلة الفعلية:
API call → returns 30 orders out of 42 → upsert all 30 → linker has only 30 to match
The 12 missing orders (including 138385901) never enter the snapshot
=> linker can't link what isn't there

الحل:
After upsert: verify count_in_db == count_from_api
If less → wait 3s → retry once → upsert deltas (idempotent)
=> snapshot completes → linker matches all 14 local orders → no UI open needed
```

```text
لماذا هذا آمن:
- onConflict(invoice_id,external_order_id) موجود مسبقاً → لا تكرار
- لا DELETE في أي مكان
- المسارات الأخرى (UI, smartBackgroundSync) لا تتأثر، فقط الإيدج فنكشن نفسها تصبح أكثر اكتمالاً
- إذا API رفضت الـ retry بـ rate-limit → الكود الحالي يعمل كما هو، بدون تراجع
```

