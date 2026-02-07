

# خطة إصلاح مشاكل مدن (التوكن، الكاش، السعر)

## ملخص المشاكل المكتشفة

| المشكلة | السبب | الأولوية |
|---------|-------|----------|
| 1️⃣ التجديد التلقائي لتوكن مدن | ✅ **يعمل بشكل صحيح** - لكن يُفعّل قبل 24 ساعة من الانتهاء فقط | منخفضة |
| 2️⃣ تحديث الكاش لمدن لا يعمل | ❌ `useCitiesCache.js` يستخدم `token` الوسيط بدلاً من توكن مدن | عالية |
| 3️⃣ تحديث سعر طلب مدن لم يتم | ⚠️ المزامنة تعمل لكن خارج ساعات العمل (8-20) لا تُنفذ | متوسطة |

---

## 1️⃣ التجديد التلقائي لتوكن مدن ✅

### الحالة الحالية
- توكن `ryus-brand` (مدن) صالح حتى **2026-02-10** (~94 ساعة متبقية)
- `auto_renew_enabled = true` ✅
- `has_password = true` ✅

### النتيجة
**لا توجد مشكلة** - التجديد التلقائي مُصمم ليعمل قبل 24 ساعة فقط من الانتهاء. التوكن سيُجدد تلقائياً في **2026-02-09**.

---

## 2️⃣ مشكلة تحديث الكاش لمدن ❌ (الأهم!)

### السبب الجذري
في ملف `src/hooks/useCitiesCache.js`:

```javascript
// السطر 15 - يأخذ token من AlWaseetContext (الوسيط فقط!)
const { token } = useAlWaseet();

// السطر 185-206 - يُرسل نفس token لمدن!
const updateCache = async (partnerName = 'alwaseet') => {
  if (!token) { ... }  // ❌ يفحص token الوسيط حتى لو partnerName='modon'
  
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { 
      token,  // ❌ يُرسل token الوسيط إلى Edge Function مدن!
      user_id: session?.user?.id 
    }
  });
};
```

**المشكلة:** عند استدعاء `updateCache('modon')`:
1. يفحص `token` (الوسيط) - قد يكون موجوداً أو غير موجود
2. يُرسل توكن الوسيط إلى `update-modon-cache` Edge Function
3. Edge Function يحاول استخدام توكن الوسيط مع API مدن → **يفشل!**

### الحل المطلوب
تعديل `useCitiesCache.js` لجلب التوكن الصحيح بناءً على `partnerName`:

```javascript
// قبل
const { token } = useAlWaseet();

// بعد - جلب التوكن ديناميكياً
const { getTokenForUser, activePartner } = useAlWaseet();
const { user } = useAuth();

const updateCache = async (partnerName = 'alwaseet') => {
  // ✅ جلب التوكن الصحيح للشريك المحدد
  const tokenData = await getTokenForUser(user?.id, null, partnerName);
  if (!tokenData?.token) {
    toast({ title: "يجب تسجيل الدخول لـ" + (partnerName === 'modon' ? 'مدن' : 'الوسيط') });
    return false;
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { 
      token: tokenData.token,  // ✅ التوكن الصحيح!
      user_id: session?.user?.id 
    }
  });
  // ...
};
```

---

## 3️⃣ مشكلة تحديث سعر طلب مدن

### التحليل
- طلب مدن `#2616423`:
  - `total_amount = 25,000`
  - `discount = 3,000`
  - `original_products_total = 28,000`
  - `delivery_status = 1` (قيد التجهيز)
  - `updated_at = 2026-02-01`

### سجلات المزامنة
```
2026-02-07 00:45:04 ⏸️ خارج ساعات العمل (8-20)
```

**السبب:** المزامنة التلقائية (`background-sync`) معطلة خارج ساعات العمل (8:00 صباحاً - 8:00 مساءً).

### الحل
1. **تشغيل مزامنة يدوية** خلال ساعات العمل
2. **أو** تعديل `background-sync` لتوسيع ساعات العمل

---

## خطة التنفيذ

### المرحلة 1: إصلاح `useCitiesCache.js` (الأولوية العليا)

```javascript
// ملف: src/hooks/useCitiesCache.js

import { useAuth } from '@/contexts/UnifiedAuthContext';

export const useCitiesCache = () => {
  const { getTokenForUser, activePartner } = useAlWaseet();
  const { user } = useAuth();
  
  // ... باقي الكود ...
  
  const updateCache = async (partnerName = 'alwaseet') => {
    setLoading(true);
    try {
      // ✅ جلب التوكن الصحيح للشريك
      const tokenData = await getTokenForUser(user?.id, null, partnerName);
      
      if (!tokenData?.token) {
        const partnerNameAr = partnerName === 'modon' ? 'مدن' : 'الوسيط';
        toast({
          title: "تنبيه",
          description: `يجب تسجيل الدخول لـ${partnerNameAr} أولاً`,
          variant: "destructive"
        });
        return false;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const functionName = partnerName === 'modon' ? 'update-modon-cache' : 'update-cities-cache';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          token: tokenData.token,  // ✅ التوكن الصحيح
          user_id: session?.user?.id 
        }
      });

      // ... باقي الكود ...
    } finally {
      setLoading(false);
    }
  };
  
  // ... باقي الكود ...
};
```

### المرحلة 2: اختبار تحديث كاش مدن
- تسجيل الدخول كمستخدم له توكن مدن
- الذهاب إلى صفحة إدارة المدن والمناطق
- اختيار مدن كشريك نشط
- الضغط على "تحديث Cache من مدن"
- التحقق من نجاح المزامنة

### المرحلة 3: تشغيل مزامنة للطلبات يدوياً
- استدعاء `sync-order-updates` Edge Function مباشرة للتحقق من تحديث سعر طلب مدن

---

## ملاحظات مهمة

### التوكنات الحالية
| الشريك | الحساب | ينتهي في | الحالة |
|--------|--------|----------|--------|
| الوسيط | alshmry94 | 2026-02-14 | ✅ تم تجديده |
| الوسيط | alshmry20 | 2026-02-10 | صالح |
| الوسيط | ryusiq | 2026-02-10 | صالح |
| مدن | ryus-brand | 2026-02-10 | صالح |

### آخر مزامنة للمدن والمناطق
- آخر مزامنة ناجحة: **2025-09-17** (منذ 5 أشهر!)
- السبب: لم يتم استدعاء `update-modon-cache` منذ ذلك الوقت

