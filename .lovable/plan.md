

# خطة إصلاح الواجهة لتعرض Jobs الصحيحة فقط

## المشكلة المكتشفة

الـ Jobs الصحيحة (61, 62) موجودة وتعمل بشكل سليم:
- **ID 61**: `smart-invoice-sync-morning` @ `15 1 * * *` = 04:15 بغداد ✅
- **ID 62**: `smart-invoice-sync-evening` @ `0 18 * * *` = 21:00 بغداد ✅

لكن دالة `get_invoice_cron_status` تبحث عن الأسماء الخاطئة (`invoice-sync-am/pm`) بدلاً من الصحيحة (`smart-invoice-sync-morning/evening`).

---

## الحل

### التعديل الوحيد المطلوب

تحديث دالة `get_invoice_cron_status` لتعرض الـ Jobs الصحيحة فقط:

```sql
CREATE OR REPLACE FUNCTION public.get_invoice_cron_status()
RETURNS TABLE (
  job_name TEXT,
  schedule TEXT,
  is_active BOOLEAN,
  next_run_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::text as job_name,
    j.schedule::text as schedule,
    j.active as is_active,
    CASE 
      WHEN j.active THEN NOW() + INTERVAL '1 hour'
      ELSE NULL
    END as next_run_at
  FROM cron.job j
  WHERE j.jobname IN (
    'smart-invoice-sync-morning', 
    'smart-invoice-sync-evening'
  )
  AND j.jobid IN (61, 62)  -- فقط الـ Jobs الصحيحة
  ORDER BY j.jobname;
END;
$$;
```

### تحديث الواجهة

تعديل `InvoiceSyncSettings.jsx` لعرض أسماء الـ Jobs بشكل صحيح:

```javascript
// السطر 375-377
{job.job_name === 'smart-invoice-sync-morning' ? 'مزامنة الصباح' : 
 job.job_name === 'smart-invoice-sync-evening' ? 'مزامنة المساء' : 
 job.job_name?.replace(/-/g, ' ')}
```

---

## النتيجة المتوقعة

| ما تختاره في الواجهة | ما يُحفظ | ما يظهر في الواجهة | ما يُنفذ فعلاً |
|---------------------|---------|-------------------|---------------|
| 04:15 صباحاً | `sync_times = ['04:15', '21:00']` | 04:15 صباحاً | ✅ 04:15 صباحاً بغداد |
| 21:00 مساءً | نفس الأعلى | 21:00 مساءً | ✅ 21:00 مساءً بغداد |

---

## ملخص الملفات المطلوب تعديلها

1. **SQL Migration جديدة**:
   - تحديث `get_invoice_cron_status` لتبحث عن `smart-invoice-sync-morning/evening` بدلاً من `invoice-sync-am/pm`

2. **src/components/settings/InvoiceSyncSettings.jsx**:
   - تحديث أسماء العرض في السطر 375-377

---

## معلومات تقنية

### لماذا Jobs القديمة لن تؤثر؟
- دالة `update_invoice_sync_schedule` الحالية (الصحيحة) تُحدّث فقط `smart-invoice-sync-morning/evening` (61, 62)
- الواجهة ستعرض فقط هذه الـ Jobs
- Jobs القديمة (17, 18, 59, 60) ستبقى موجودة لكن **لن تُستخدم ولن تُعرض**

### ماذا يحدث عند تغيير الوقت؟
1. تختار 05:30 صباحاً في الواجهة
2. تُستدعى `update_invoice_sync_schedule('05:30', '21:00')`
3. تُحذف `smart-invoice-sync-morning/evening` القديمة وتُنشأ جديدة
4. Job 61 تُحذف وتُنشأ بجدولة `30 2 * * *` (05:30 بغداد = 02:30 UTC)
5. الواجهة تُحدّث وتعرض 05:30

