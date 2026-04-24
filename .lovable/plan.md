

# الحل النهائي - ربط الفواتير تلقائياً + IP الوسيط

## أولاً: IP السيرفر لشركة الوسيط (Whitelist)

أعطِ شركة الوسيط هذا الـ IP العام لإضافته في القائمة البيضاء:

```
52.57.82.157
```

- موقع السيرفر: AWS Lightsail – فرانكفورت (أوروبا)
- الدومين: `api.ryusbrand.com`
- جميع طلبات AlWaseet و MODON الآن تخرج من هذا الـ IP الثابت حصراً

---

## ثانياً: السبب الجذري الحقيقي لعدم ربط الفاتورة 3247172

### ما اكتشفته بالفحص الفعلي (مؤكد، لا افتراضات)

استدعيت AlWaseet API مباشرة وحصلت على الرد الحقيقي للفاتورة 3247172:

```json
{
  "status": true,
  "errNum": "S000",
  "data": {
    "invoice": [ {...} ],
    "orders":  [ 42 طلب فعلي بأرقام 137987578، 137987585،... ]
  }
}
```

API يُرجع الطلبات داخل `data.orders` (مصفوفة داخل كائن)، **وليس** في `data` كمصفوفة مباشرة.

### الكود الحالي في `smart-invoice-sync` (السطر 99-101) معطوب:

```ts
if (ok && Array.isArray(data?.data))   return data.data;     // ❌ data.data كائن وليس مصفوفة
if (ok && Array.isArray(data?.orders)) return data.orders;   // ❌ غير موجود في الجذر
if (Array.isArray(data))               return data;
return [];                                                    // ← يصل هنا دائماً
```

النتيجة: دالة `fetchInvoiceOrdersFromAPI` ترجع **مصفوفة فارغة دائماً** للفواتير غير المستلمة، فلا يُكتب ولا سجل واحد في `delivery_invoice_orders`، وبالتالي `link_invoice_orders_to_orders` لا تجد ما تربطه.

### حاجز إضافي في نفس الملف (السطر 460-463):

```ts
if (!force_refresh && existing && !statusChanged && existing.received === isReceived) {
  continue;  // ❌ يقفز قبل محاولة جلب الطلبات
}
```

يقفز حتى عن محاولة جلب الطلبات إذا كانت الفاتورة موجودة بنفس الحالة، حتى لو كانت `dio_count = 0`.

### لماذا الفاتورة السابقة 3210286 ارتبطت ولم تتأثر؟

الجدول `delivery_invoice_orders` لها يحتوي 60 سجل، لكن:
- `status = NULL`، `amount = NULL`، `is_fallback = NULL`
- `created_at = 2026-04-19` (قبل تعديلات smart-invoice-sync الأخيرة)

أي أنها كُتبت من **مسار قديم آخر** (إما من `useAlWaseetInvoices.fetchInvoiceOrders` عند فتح الفاتورة في الواجهة، أو من Edge Function أقدم). الكود الحالي لو واجه نفس الفاتورة الجديدة سيفشل بنفس الطريقة.

---

## ثالثاً: الإصلاحات (دقيقة، آمنة، نهائية)

### 1) `supabase/functions/smart-invoice-sync/index.ts` — إصلاح parser الطلبات

في `fetchInvoiceOrdersFromAPI` (السطر 96-103) تعديل المنطق ليستخلص الطلبات بترتيب صحيح ومرن:

```ts
const ok = data?.status === true || data?.errNum === 'S000';
if (!ok) return [];

// ✅ AlWaseet: data.data.orders (الواقع الفعلي)
if (Array.isArray(data?.data?.orders)) return data.data.orders;
// ✅ MODON / صيغ بديلة
if (Array.isArray(data?.orders))       return data.orders;
if (Array.isArray(data?.data))         return data.data;
if (Array.isArray(data))               return data;
return [];
```

### 2) إزالة الـ skip القاتل في SMART mode (السطر 460-463)

تعديل الشرط ليُسمح بإكمال جلب الطلبات إذا كانت الفاتورة لها `orders_count > 0` لكن لا توجد سجلات في `delivery_invoice_orders` بعد:

```ts
// تحقق فعلي من dio_count قبل القفز
if (!force_refresh && existing && !statusChanged && existing.received === isReceived) {
  // لكن لا نقفز إذا الفاتورة بحاجة طلباتها
  if (sync_orders) {
    const { count: dioCount } = await supabase
      .from('delivery_invoice_orders')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', existing.id);
    if ((dioCount ?? 0) > 0) continue;  // عندها فقط نقفز
  } else {
    continue;
  }
}
```

نفس المنطق يُطبَّق في COMPREHENSIVE mode (السطر 229-231) إذا لزم.

### 3) ضمان حقل `partner` و `owner_user_id` صحيحان في upsert الطلبات

السطر 287-294 و 501-508: التأكد من تمرير `owner_user_id` (موجود) — لا حاجة لـ `partner` (العمود غير موجود في الجدول، تأكدت).

### 4) إعادة مزامنة فورية للفاتورة 3247172 بعد deploy

بعد deploy التعديلات:
- استدعاء `smart-invoice-sync` بـ `mode='comprehensive', sync_orders=true, force_refresh=true` للموظف `91484496-b887-44f7-9e5d-be9db5567604`
- النتيجة المتوقعة: 42 سجل في `delivery_invoice_orders` للفاتورة → استدعاء `link_invoice_orders_to_orders` يربط الـ 14 طلباً المحلي تلقائياً (منها الطلب `138385901`)
- **بدون فتح الفاتورة في الواجهة**

### 5) ضمان أن المزامنة الخلفية المستقبلية تربط دائماً

المزامنة الخلفية (`useAlWaseetInvoices.smartBackgroundSync`) تستدعي بـ `sync_orders: true` (تم سابقاً). بعد إصلاح parser، سيتم:
1. جلب الفاتورة من API
2. جلب طلبات الفاتورة (الآن بشكل صحيح)
3. upsert إلى `delivery_invoice_orders`
4. استدعاء `link_invoice_orders_to_orders` (يعمل بالفعل)
5. الطلبات المحلية تتربط بالفاتورة تلقائياً

---

## النتائج المتوقعة

| العنصر | قبل | بعد |
|---|---|---|
| فاتورة 3247172 dio_count | 0 | 42 ✅ |
| طلب 138385901 مرتبط | ❌ | ✅ |
| 14 طلب محلي للفاتورة 3247172 | غير مرتبطة | مرتبطة كلها ✅ |
| أي فاتورة جديدة من المزامنة الخلفية | تُحفظ بدون طلبات | تُحفظ + طلباتها + الربط تلقائياً ✅ |
| الحاجة لفتح الفاتورة من الواجهة | كانت شرطاً | لم تعد شرطاً ✅ |
| الفواتير القديمة المستلمة (60+، 63، 103، إلخ) | تعمل ✅ | تبقى تعمل بلا تأثير ✅ |

---

## ضمانات صارمة (لا تخريب)

- ❌ لا تعديل على schema جداول `delivery_invoices` أو `delivery_invoice_orders` أو `orders`
- ❌ لا حذف لأي بيانات (سجلات `dio` الحالية تبقى)
- ❌ لا تعديل على دالة `link_invoice_orders_to_orders` (مُصلحة وتعمل)
- ❌ لا تعديل على الفواتير المستلمة سابقاً (`receipt_received=true` يبقى يعمل)
- ❌ لا تعديل على الكاش في هذه الدفعة (سننتقل له بعد تأكيد نجاح الفواتير)
- ✅ التعديلات محصورة في ملف واحد: `supabase/functions/smart-invoice-sync/index.ts`

## الملف المعدل الوحيد

| الملف | التغيير |
|---|---|
| `supabase/functions/smart-invoice-sync/index.ts` | إصلاح parser في `fetchInvoiceOrdersFromAPI` + شرط skip ذكي يحترم `dio_count` |

## تفاصيل تقنية للسبب الجذري

```
رد API الحقيقي للفاتورة 3247172:
{
  data: {
    invoice: [...],
    orders:  [42 طلب]   ← هنا فعلاً
  }
}

الكود الحالي يبحث في:
  data.data    → كائن، ليس مصفوفة → يُتجاهل
  data.orders  → undefined         → يُتجاهل
  data         → كائن               → يُتجاهل
  return []                         ← دائماً

بعد الإصلاح:
  data.data.orders → 42 طلب → upsert → link_invoice_orders_to_orders → ربط 14 طلب محلي
```

