

# خطة إصلاح التجديد التلقائي للتوكن - حساب alshmry94

## المشكلة المكتشفة

### الحالة الحالية للتوكن
| البند | القيمة |
|-------|--------|
| الحساب | alshmry94 |
| الشريك | alwaseet |
| ينتهي في | 2026-02-07 14:14:36 |
| الوقت المتبقي | **13.7 ساعة** |
| auto_renew_enabled | **true** ✅ |
| is_active | **true** ✅ |

### السبب الجذري - URL خاطئ في Edge Function!

عند تشغيل `refresh-delivery-partner-tokens` يدوياً، ظهر الخطأ:
```
error sending request for url (https://app.alwaseet-ye.com/api/login): 
dns error: failed to lookup address information: Name or service not known
```

**المشكلة:** الدالة تستخدم URL قديم/خاطئ:
```typescript
// ❌ خاطئ - غير موجود!
https://app.alwaseet-ye.com/api/login

// ✅ صحيح - يجب استخدامه
https://api.alwaseet-iq.net/v1/merchant/login
```

---

## الحل المطلوب

### تعديل ملف `supabase/functions/refresh-delivery-partner-tokens/index.ts`

تغيير دالة `loginToAlWaseet` لاستخدام URL الصحيح:

**قبل (خاطئ):**
```typescript
const response = await fetch('https://app.alwaseet-ye.com/api/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({ identifier: username, password }),
});
```

**بعد (صحيح):**
```typescript
const response = await fetch('https://api.alwaseet-iq.net/v1/merchant/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  body: JSON.stringify({ username, password }),  // ✅ تغيير identifier إلى username
});
```

---

## التغييرات المطلوبة

### 1. إصلاح URL الوسيط (ALWASEET)
- تغيير `https://app.alwaseet-ye.com/api/login` ← `https://api.alwaseet-iq.net/v1/merchant/login`
- تغيير body من `{ identifier, password }` ← `{ username, password }`
- إضافة معالجة response structure الصحيحة

### 2. إضافة Constants للـ URLs
```typescript
const ALWASEET_API_BASE = 'https://api.alwaseet-iq.net/v1/merchant';
const MODON_API_BASE = 'https://mcht.modon-express.net/v1/merchant';
```

### 3. تحسين معالجة Response
الـ API يُرجع structure مختلفة:
```json
{
  "status": true,
  "errNum": "S000",
  "msg": "تم تسجيل الدخول",
  "data": {
    "token": "xxx...",
    "merchant_id": 123
  }
}
```

---

## خطوات التنفيذ

1. **تعديل `refresh-delivery-partner-tokens/index.ts`**:
   - إصلاح URL الوسيط
   - تصحيح بنية الطلب (username بدلاً من identifier)
   - تحسين معالجة الاستجابة

2. **نشر Edge Function**

3. **تشغيل التجديد يدوياً للتحقق**

---

## التحقق بعد التنفيذ

سيتم استدعاء Edge Function يدوياً للتأكد من:
- نجاح الاتصال بـ API الوسيط
- تجديد توكن alshmry94 بنجاح
- تحديث expires_at إلى 7 أيام جديدة

---

## ملاحظات إضافية

### Cron Job يستخدم Token قديم
لاحظت أن الـ Cron Job `refresh-delivery-tokens-daily` يستخدم Authorization token قديم:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...eyJpYXQiOjE3MzYzMjMzNjAsImV4cCI6MjA1MTg5OTM2MH0...
```

هذا Token من مشروع سابق (`iat: 1736323360` = يناير 2025). لكن بما أن الدالة لا تتطلب JWT (`verify_jwt = false`)، فهذا لن يؤثر على العمل.

### الملف المتأثر
| الملف | التعديل |
|-------|---------|
| `supabase/functions/refresh-delivery-partner-tokens/index.ts` | إصلاح URL + body structure |

