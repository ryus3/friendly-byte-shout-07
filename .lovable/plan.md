

# خطة الإصلاح الجذري لمشكلة الجدولة

## المشكلة الجذرية
وجدنا أن هناك **تضارب** في الـ Cron Jobs:
- `invoice-sync-am/pm` (من الواجهة): تستخدم URL خاطئ وبدون Authorization
- `smart-invoice-sync-morning/evening`: صحيحة لكن لا تتحدث عند تغيير الوقت

## الحل الجذري

### الخطوة 1: حذف كل الـ Jobs المتضاربة
```sql
-- حذف Jobs بـ URL خاطئ
SELECT cron.unschedule(59); -- invoice-sync-am (خاطئ)
SELECT cron.unschedule(60); -- invoice-sync-pm (خاطئ)
```

### الخطوة 2: تحديث Jobs الصحيحة بالوقت المطلوب
```sql
-- تحديث smart-invoice-sync-morning لتعمل 04:15 بغداد = 01:15 UTC
SELECT cron.unschedule('smart-invoice-sync-morning');
SELECT cron.schedule(
  'smart-invoice-sync-morning',
  '15 1 * * *',
  -- نفس الـ command الصحيح الموجود
);

-- تحديث smart-invoice-sync-evening لتعمل 21:00 بغداد = 18:00 UTC
SELECT cron.unschedule('smart-invoice-sync-evening');
SELECT cron.schedule(
  'smart-invoice-sync-evening', 
  '0 18 * * *',
  -- نفس الـ command الصحيح
);
```

### الخطوة 3: إصلاح دالة `update_invoice_sync_schedule`
تعديل الدالة لتُحدّث `smart-invoice-sync-morning/evening` بدلاً من إنشاء `invoice-sync-am/pm` بمسار خاطئ.

**التغيير الجذري**:
- استخدام URL الصحيح: `https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync`
- استخدام Anon Key الصحيح
- التحويل الزمني: وقت بغداد - 3 ساعات = UTC

### الخطوة 4: تحديث `auto_sync_schedule_settings`
```sql
UPDATE auto_sync_schedule_settings 
SET sync_times = ARRAY['04:15', '21:00']::text[]
WHERE id = '00000000-0000-0000-0000-000000000001';
```

---

## الملفات المطلوب تعديلها

### 1. SQL Migration جديدة
- حذف الـ Cron Jobs الخاطئة (59, 60)
- إنشاء دالة `update_invoice_sync_schedule` مُصححة تستخدم:
  - URL: `https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync`
  - Authorization: Bearer + anon key
  - تحديث `smart-invoice-sync-morning/evening` بدلاً من إنشاء jobs جديدة

### 2. لا تغيير على الواجهة
`InvoiceSyncSettings.jsx` صحيح - يقرأ الوقت من `auto_sync_schedule_settings.sync_times`

---

## النتيجة المتوقعة

| الوقت الذي تختاره | الـ Cron Job | التنفيذ الفعلي |
|-------------------|--------------|----------------|
| 04:15 صباحاً بغداد | `15 1 * * *` UTC | ✅ 04:15 صباحاً بالضبط |
| 21:00 مساءً بغداد | `0 18 * * *` UTC | ✅ 21:00 مساءً بالضبط |

## معلومات تقنية

### لماذا كان الزر اليدوي يعمل؟
الزر اليدوي يستخدم `supabase.functions.invoke()` الذي:
- يستخدم URL المشروع الصحيح تلقائياً من الـ client config
- يُرسل Authorization header من الـ session الحالية

### لماذا الـ Cron كان يفشل؟
الـ Cron Jobs `invoice-sync-am/pm` كانت:
- تستدعي مشروع مختلف (`rqwrv...`)
- بدون Authorization token

---

## التحقق بعد التنفيذ
1. Query على `cron.job` للتأكد من عدم وجود URL خاطئ
2. التأكد أن `smart-invoice-sync-morning/evening` تستخدم الوقت الصحيح
3. مراقبة الـ Edge Function logs في الوقت المجدول

