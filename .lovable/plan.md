
# تقرير فحص عميق: الطلب 121347070 ومزامنة مدن

---

## المشكلة الأولى: الطلب 121347070 في نافذة المخزون المحجوز

### التشخيص

حالة الطلب في قاعدة البيانات:
```
qr_id: 121347070
status: returned (مُرجع)
delivery_status: 17 (تم الإرجاع للتاجر)
order_type: partial_delivery
receipt_received: true
delivery_partner: alwaseet
```

حالة العنصر في order_items:
```
item_status: pending (لا يزال!)
item_direction: null
```

### السبب الجذري

فلتر نافذة المخزون المحجوز في السطر 42:
```javascript
// ReservedStockDialog.jsx - الفلتر الحالي
return orders?.filter(order => 
  ['pending', 'shipped', 'delivery', 'returned'].includes(order.status) &&  // ⚠️ يشمل returned!
  order.status !== 'returned_in_stock' &&
  order.status !== 'completed'
) || [];
```

المشكلة المزدوجة:
1. الفلتر يشمل `'returned'` ضمن الحالات المحجوزة - لكن هذا صحيح للطلبات المعادة التي لم تصل للتاجر بعد
2. العنصر لا يزال `item_status = 'pending'` رغم أن الطلب `delivery_status = 17` (مُرجع للتاجر)

### الحل المطلوب

إضافة شرط استثناء إضافي يستبعد الطلبات التي:
- `delivery_status = '17'` (تم الإرجاع للتاجر فعلياً)

تعديل السطور 40-46:
```javascript
const reservedOrders = useMemo(() => {
  return orders?.filter(order => {
    // ✅ استثناء مبدئي: delivery_status = 17 أو 4 لا يُحجز أبداً
    const ds = String(order.delivery_status || '');
    if (ds === '4' || ds === '17') return false;
    
    // الفلترة حسب status
    return ['pending', 'shipped', 'delivery', 'returned'].includes(order.status) &&
      order.status !== 'returned_in_stock' &&
      order.status !== 'completed';
  }) || [];
}, [orders]);
```

---

## المشكلة الثانية: مزامنة حالة الطلبات في شركة مدن لا تعمل

### التشخيص العميق

#### 1. حالة التوكنات

| الشركة | الحسابات النشطة | الصلاحية |
|--------|-----------------|----------|
| **الوسيط** | 3 حسابات | صالحة حتى يناير-فبراير 2026 ✅ |
| **مدن** | 0 حسابات | Token منتهي منذ نوفمبر 2025 ❌ |

التوكن الوحيد لمدن:
```
account_username: ryus-brand
partner_name: modon
is_active: false
expires_at: 2025-11-18 (منتهي!)
```

#### 2. الطلبات في قاعدة البيانات

| الشركة | عدد الطلبات |
|--------|-------------|
| الوسيط | 600 طلب |
| مدن | 0 طلب |

**لا توجد أي طلبات من مدن في النظام حالياً!**

### كيف يعمل النظام الحالي (مقارنة)

#### مزامنة الوسيط (تعمل بشكل صحيح)
```
API: https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=xxx
edge function: sync-order-updates (يعالج كلا الشركتين)
edge function: smart-invoice-sync (يعالج الوسيط فقط حالياً!)
```

الفرق الخطير: `smart-invoice-sync` يفلتر على `partner_name = 'alwaseet'` فقط:
```typescript
// smart-invoice-sync/index.ts - السطر 182
.eq('partner_name', 'alwaseet')  // ❌ لا يشمل مدن!
```

#### مزامنة مدن (الآلية المُعدّة لكن غير فعّالة)
```
API: https://mcht.modon-express.net/v1/merchant/merchant-orders?token=xxx
edge function: sync-order-updates (يدعم مدن ✅)
edge function: modon-proxy (يعمل ✅)
lib: modon-api.js (مكتمل ✅)
statuses: modon-statuses.js (15 حالة معرّفة ✅)
```

### هل المزامنة تعرف أي شركة ينتمي إليها كل طلب؟

**نعم!** النظام مُصمم بشكل صحيح للفصل:

#### 1. في قاعدة البيانات
```sql
orders.delivery_partner = 'alwaseet' | 'modon'
delivery_partner_tokens.partner_name = 'alwaseet' | 'modon'
delivery_invoices.partner = 'alwaseet' | 'modon'
```

#### 2. في sync-order-updates (Edge Function)
```typescript
// السطر 88: جلب توكنات كلا الشركتين
.in('partner_name', ['alwaseet', 'modon'])

// السطر 108-114: تحديد API URL بناءً على الشركة
const apiUrl = partnerName === 'modon'
  ? `https://mcht.modon-express.net/v1/merchant/merchant-orders?token=xxx`
  : `https://api.alwaseet-iq.net/v1/merchant/merchant-orders?token=xxx`;

// السطر 126-129: كل طلب يحمل علامة _partner
const ordersWithAccount = result.data.map((order) => ({
  ...order,
  _account: tokenRecord.account_username,
  _partner: partnerName  // ✅ يحدد الشركة
}));

// السطر 201-205: حماية ضد التداخل!
if (waseetOrder._partner !== localOrder.delivery_partner) {
  console.warn(`⚠️ تم تجاهل الطلب - تداخل بين الشركات!`);
  continue;  // ✅ يتجاهل الطلب إذا كان من شركة مختلفة
}
```

**الحماية موجودة وتعمل!** لن يحدث تداخل بين الشركتين حتى لو كان التوكنان نشطين.

### لماذا المزامنة لا تعمل؟

**السبب الوحيد: لا يوجد Token نشط لمدن!**

1. Token مدن الوحيد منتهي الصلاحية منذ نوفمبر 2025
2. لا توجد طلبات من مدن في قاعدة البيانات
3. `smart-invoice-sync` لا يدعم مدن أصلاً (يفلتر على alwaseet فقط)

---

## فجوات في الكود تحتاج إصلاح

### 1. smart-invoice-sync لا يدعم مدن
```typescript
// الحالي (السطر 182):
.eq('partner_name', 'alwaseet')

// المطلوب:
.in('partner_name', ['alwaseet', 'modon'])
```

### 2. URLs ثابتة للوسيط فقط
```typescript
// الحالي (السطر 10):
const ALWASEET_API_BASE = 'https://api.alwaseet-iq.net/v1/merchant';

// المطلوب: إضافة MODON_API_BASE
const MODON_API_BASE = 'https://mcht.modon-express.net/v1/merchant';
```

### 3. دوال API لا تدعم مدن
```typescript
// الحالية: fetchInvoicesFromAPI تستخدم ALWASEET_API_BASE فقط
// المطلوب: معامل partner لتحديد الشركة
async function fetchInvoicesFromAPI(token, partner = 'alwaseet') {
  const baseUrl = partner === 'modon' ? MODON_API_BASE : ALWASEET_API_BASE;
  // ...
}
```

---

## ملخص التعديلات المطلوبة

### ملف 1: ReservedStockDialog.jsx
- إضافة استثناء `delivery_status = '17'` و `'4'` من المخزون المحجوز
- يحل مشكلة الطلب 121347070

### ملف 2: smart-invoice-sync/index.ts
- دعم مدن في مزامنة الفواتير
- إضافة MODON_API_BASE
- تعديل فلترة التوكنات لتشمل مدن
- تمرير partner إلى دوال API

### متطلب أساسي (من المستخدم)
- **تسجيل دخول جديد لحساب مدن** لتفعيل التوكن
- بدون توكن نشط، المزامنة مستحيلة!

---

## الملفات التي سيتم تعديلها

| الملف | التعديل |
|-------|---------|
| `src/components/inventory/ReservedStockDialog.jsx` | استثناء delivery_status 4 و 17 |
| `supabase/functions/smart-invoice-sync/index.ts` | دعم مدن في مزامنة الفواتير |

---

## المعلومات التقنية

### مقارنة APIs (الوسيط vs مدن)

| الميزة | الوسيط | مدن |
|--------|--------|-----|
| جلب الطلبات | `GET merchant-orders?token=xxx` | `GET merchant-orders?token=xxx` ✅ متطابق |
| جلب طلبات بالدفعة | `POST get-orders-by-ids-bulk` (25 max) | `POST get-orders-by-ids-bulk` (25 max) ✅ متطابق |
| جلب الفواتير | `GET get_merchant_invoices?token=xxx` | `GET get_merchant_invoices?token=xxx` ✅ متطابق |
| طلبات الفاتورة | `GET get_merchant_invoice_orders` | `GET get_merchant_invoice_orders` ✅ متطابق |
| استلام الفاتورة | `GET receive_merchant_invoice` | `GET receive_merchant_invoice` ✅ متطابق |
| حذف طلب | فقط إذا status=1 | فقط إذا status=1 ✅ متطابق |
| Webhooks | دعم webhook | دعم webhook ✅ متطابق |
| ملاحظة | - | يتطلب Merchant token للفواتير |

### حالات مدن المعرّفة (15 حالة)

| الرقم | النص | الحالة المحلية | يحرر المخزون؟ |
|-------|------|----------------|---------------|
| 1 | طلب جديد | pending | ❌ |
| 2 | استلام من المندوب | shipped | ❌ |
| 3 | قيد التوصيل | delivery | ❌ |
| 4 | تم التسليم | delivered | ✅ |
| 7 | تم الإرجاع للتاجر | returned_in_stock | ✅ |

---

## خطوات التنفيذ

1. إصلاح ReservedStockDialog.jsx (الطلب 121347070)
2. إصلاح smart-invoice-sync لدعم مدن
3. **مطلوب من المستخدم**: تسجيل دخول جديد لحساب مدن لتفعيل التوكن
4. اختبار المزامنة بعد تفعيل التوكن
