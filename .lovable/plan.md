

# خطة إصلاح: تجديد توكن مدن التلقائي

## المشكلة المكتشفة

دالة `refresh-delivery-partner-tokens` لا تدعم مدن:

```typescript
// السطر 86 - يُفلتر على الوسيط فقط!
.eq('partner_name', 'alwaseet')

// السطر 122 - يستدعي تسجيل دخول الوسيط فقط!
const loginResult = await loginToAlWaseet(username, password);
```

**النتيجة:** توكن مدن **لن يتجدد تلقائياً** عند انتهاء صلاحيته!

---

## الحل المقترح

### 1. إضافة دالة `loginToModon()`

```typescript
async function loginToModon(username: string, password: string): Promise<LoginResponse> {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);

  const response = await fetch('https://mcht.modon-express.net/v1/merchant/login', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (data.status && data.data?.token) {
    return {
      success: true,
      token: data.data.token,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return { success: false, error: data.msg || 'Login failed' };
}
```

### 2. تعديل استعلام جلب التوكنات

```typescript
// قبل:
.eq('partner_name', 'alwaseet')

// بعد:
.in('partner_name', ['alwaseet', 'modon'])
```

### 3. تعديل حلقة التجديد

```typescript
for (const tokenRecord of tokens) {
  // ...
  let loginResult;
  if (tokenRecord.partner_name === 'modon') {
    loginResult = await loginToModon(username, password);
  } else {
    loginResult = await loginToAlWaseet(username, password);
  }
  // ...
}
```

---

## التحقق: هل المزامنة تعرف أي طلب لأي شركة؟

**نعم! 100% آمن:**

```typescript
// sync-order-updates/index.ts - السطور 201-205
if (waseetOrder._partner !== localOrder.delivery_partner) {
  console.warn(`⚠️ تم تجاهل الطلب - تداخل بين الشركات!`);
  continue;  // ✅ لن يتم تحديث الطلب
}
```

### بنية البيانات:
| الجدول | الحقل | القيم |
|--------|-------|-------|
| `orders` | `delivery_partner` | `'alwaseet'` أو `'modon'` |
| `delivery_partner_tokens` | `partner_name` | `'alwaseet'` أو `'modon'` |
| `delivery_invoices` | `partner` | `'alwaseet'` أو `'modon'` |

### مسار المزامنة:
```text
1. جلب كل التوكنات النشطة (alwaseet + modon)
2. لكل توكن: جلب الطلبات من API الشركة المناسبة
3. تمييز كل طلب بـ `_partner: partnerName`
4. عند المطابقة: التحقق من `_partner === delivery_partner`
5. ❌ إذا تختلف الشركة → تجاهل (لا تداخل)
6. ✅ إذا تتطابق → تحديث الطلب
```

---

## الملفات التي سيتم تعديلها

| الملف | التعديل |
|-------|---------|
| `supabase/functions/refresh-delivery-partner-tokens/index.ts` | إضافة `loginToModon()` + تعديل الفلتر والحلقة |

---

## النتيجة المتوقعة

| الميزة | قبل | بعد |
|--------|-----|-----|
| تجديد توكن الوسيط | ✅ يعمل | ✅ يعمل |
| تجديد توكن مدن | ❌ لا يعمل | ✅ يعمل |
| مزامنة طلبات مدن | ✅ يعمل | ✅ يعمل |
| فصل الشركات | ✅ آمن | ✅ آمن |

