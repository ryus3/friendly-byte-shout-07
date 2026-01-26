
# خطة إصلاح مشكلة حالة الطلب "Completed" الخاطئة

## المشكلة المكتشفة
الطلب **#121313050 (ORD000724)** يظهر كـ `completed` رغم أن:
- ربح الموظف = **7,000 د.ع** (وليس 0)
- الفاتورة **#2714651** لا تزال **معلقة** (`received: false`)

## السبب الجذري
يوجد مسار في الكود يُغيّر الـ status إلى completed بدون التحقق من `receipt_received`.

## خطوات الإصلاح

### الخطوة 1: تصحيح الطلب فوراً
```sql
UPDATE orders 
SET status = 'delivered'
WHERE tracking_number = '121313050' 
  AND receipt_received = false;
```

### الخطوة 2: إصلاح أي طلبات مشابهة
```sql
UPDATE orders 
SET status = 'delivered'
WHERE status = 'completed' 
  AND receipt_received = false
  AND delivery_status = '4';
```

### الخطوة 3: تعديل ملف return-status-handler.js
تغيير `order_status: 'completed'` إلى `status: 'completed'` مع إضافة شرط التحقق من الفاتورة.

## النتيجة المتوقعة
- الطلب #121313050 يعود لحالة `delivered`
- لن يصبح `completed` إلا بعد استلام الفاتورة #2714651
- جميع الطلبات المتأثرة تُصحح تلقائياً
