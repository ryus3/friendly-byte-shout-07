
# خطة إصلاح مشكلتي الجدولة وحالة الطلب

## المشكلة 1: إصلاح جدولة المزامنة التلقائية

### 1.1 حذف الـ Cron Jobs الخاطئة
```sql
SELECT cron.unschedule(55);
SELECT cron.unschedule(56);
```

### 1.2 إعادة إنشاء الـ Cron Jobs بالبيانات الصحيحة
- استخدام URL الصحيح: `tkheostkubborwkwzugl.supabase.co`
- إضافة الـ Anon Key الصحيح
- تحويل الوقت: 09:00 بغداد = 06:00 UTC، 21:00 بغداد = 18:00 UTC

```sql
-- صباح: 09:00 بغداد = 06:00 UTC
SELECT cron.schedule(
  'invoice-sync-am',
  '0 6 * * *',
  $$SELECT net.http_post(
    url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/smart-invoice-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:='{"mode": "comprehensive", "sync_invoices": true, "sync_orders": true}'::jsonb
  )$$
);

-- مساء: 21:00 بغداد = 18:00 UTC
SELECT cron.schedule(
  'invoice-sync-pm',
  '0 18 * * *',
  $$SELECT net.http_post(...)$$
);
```

### 1.3 تحديث جدول الإعدادات
```sql
UPDATE auto_sync_schedule_settings 
SET sync_times = ARRAY['09:00', '21:00']
WHERE id = '00000000-0000-0000-0000-000000000001';
```

---

## المشكلة 2: تصحيح منطق حالة "Completed"

### 2.1 تعديل Trigger `auto_complete_zero_profit_orders`
**الوضع الحالي**: يُكمل الطلب تلقائياً عند `delivery_status = '4'` إذا كان الربح = 0

**الوضع المطلوب**: يجب أن يُكمل الطلب فقط عندما:
- `delivery_status = '4'` (مُسلّم)
- **و** `receipt_received = true` (الفاتورة مُستلمة)

```sql
CREATE OR REPLACE FUNCTION auto_complete_zero_profit_orders()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط إذا كانت الفاتورة مستلمة
  IF NEW.receipt_received = true 
     AND NEW.status NOT IN ('completed', 'returned', 'cancelled')
     AND COALESCE(NEW.employee_profit, 0) = 0 
  THEN
    NEW.status := 'completed';
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 إصلاح الطلب ORD000724
```sql
UPDATE orders 
SET status = 'delivered'  -- إعادة للحالة الصحيحة
WHERE order_number = 'ORD000724' 
  AND receipt_received = false;
```

### 2.3 إصلاح أي طلبات أخرى مشابهة
```sql
UPDATE orders 
SET status = 'delivered'
WHERE status = 'completed' 
  AND receipt_received = false
  AND delivery_status = '4';
```

---

## النتيجة المتوقعة
1. المزامنة ستعمل في 09:00 صباحاً و 21:00 مساءً بتوقيت بغداد بدقة
2. الطلبات ستصبح "completed" فقط بعد استلام الفاتورة من شركة التوصيل
3. الطلب ORD000724 سيعود لحالة "delivered" حتى تُستلم الفاتورة #2714651
