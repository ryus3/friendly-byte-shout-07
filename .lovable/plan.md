## المشكلة الجذرية

بعد الفحص العميق وجدت:

1. **65 سجل وهمي:** التريغر `auto_detect_off_channel` يُنشئ تلقائياً سجلاً في `off_channel_collections` بحالة `pending_classification` لكل طلب مُسلَّم في فواتير التوصيل (سواء صنّفه البائع أم لا). ولهذا تظهر 66 بطاقة بدل واحدة فقط. الطلب الوحيد الذي صنّفه البائع فعلاً (149922672) حالته `pending_owner_confirmation` وقيمته 25,000.
2. **لم يصل إشعار لأحمد:** الهجرة السابقة حذفت كل إشعارات `off_channel_pending_confirmation` ثم نفّذت `UPDATE ... SET status = status` لإعادة الإطلاق، لكن شرط التريغر `OLD.status IS DISTINCT FROM NEW.status` كان `false` (نفس القيمة) فلم يُرسَل أي إشعار.
3. **الكرت عند المدير = 0:** يستخدم scope=`inbox` (مرشَّح بـ `owner_user_id = me`)، فلا يظهر له شيء.
4. **النافذة الإجبارية تعرض كل السجلات بانتظار التصنيف** بدلاً من المُصنَّفة فقط.

## التعديلات

### 1) منطق العرض (المصدر الموحَّد للحقيقة)
في `src/hooks/useOffChannelCollections.js`:
- `scope='inbox'` يصبح مرشَّحاً على **`status = 'pending_owner_confirmation'` فقط** (إزالة `pending_classification`). هذا يُسقط الـ 65 سجل الوهمي تلقائياً من الكرت والنافذة الإجبارية والصفحة.
- إضافة scope جديد `'manager_pending'` للمدير: يُرجع كل السجلات بحالة `pending_owner_confirmation` بدون مرشِّح owner.

### 2) كرت "تحصيلات بانتظار التأكيد" — `PendingCollectionsCard.jsx`
- نقله في `src/pages/Dashboard.jsx` إلى **أسفل بطاقة "متابعة الموظفين"** مباشرة.
- نقل الـBadge الأحمر ليكون **بجانب العنوان** داخل `CardHeader` (بدل أعلى الأيقونة) — يطابق الصورة `IMG_3350` المرغوبة.
- استخدام `scope='manager_pending'` عند `isAdmin`، و`'inbox'` للمالك العادي. هكذا يرى المدير العدد الإجمالي (1 الآن).

### 3) النافذة الإجبارية — `OffChannelMandatoryDialog.jsx`
- تبقى تستخدم `scope='inbox'` (الآن مُصفَّى تلقائياً على `pending_owner_confirmation` فقط).
- النتيجة: لن تظهر إلا للمالك الذي صنّف البائع تحصيلاً له (أحمد سيراها لطلب 149922672 فقط).

### 4) صفحة `OffChannelOwnerInbox.jsx`
- إضافة **Pagination** بنفس تصميم صفحة "متابعة الطلبات":
  - 10 سجلات/صفحة، شريط أرقام صفحات (Prev/Next + أرقام)، يعتمد مكوّن `Pagination` من shadcn الموجود في المشروع.
- المدير يستخدم scope جديد `'manager_all'` (كل السجلات بدون مرشِّح owner، مع كل الحالات للفلترة بالـTabs).
- المالك العادي scope=`inbox` (المُصنَّفة فقط).
- التبويبات تبقى: الكل / معلق / مؤكد / غير مستلم (بحسب status).

### 5) Migration: تنظيف + إعادة إرسال الإشعار الصحيح
- **حذف السجلات الوهمية**: حذف كل `off_channel_collections` بحالة `pending_classification` (الـ65) — لأن التريغر يعيد إنشاءها عند الحاجة عبر `delivery_invoice_orders`، لكن يجب إيقاف هذا التضخّم.
- **تعديل التريغر** `auto_detect_off_channel`: لا يُنشئ سجلاً تلقائياً بعد الآن — يبقى السجل يُنشأ فقط من نافذة التصنيف اليدوية في `OffChannelClassifyDialog.jsx` (عبر `useOffChannelCollections.classify` التي ستُعدَّل لتعمل بـ`upsert`).
  - تعديل `classify()` في الـhook ليستخدم upsert على `(order_id)` إذا لم يوجد سجل مسبقاً.
- **إعادة إرسال الإشعار**: `INSERT` يدوي في `notifications` لطلب 149922672 (وأي طلب آخر بحالة `pending_owner_confirmation` بدون إشعار).

### 6) ملاحظات
- بدون أي تغيير في الكرت/التصميم العام للداشبورد ولا مس المنطق المالي خارج هذا النطاق.
- بعد التطبيق: الكرت = **1**، النافذة الإجبارية تظهر لأحمد بطلب 149922672 فقط، الإشعار يصل في الجرس.

### الملفات المُعدَّلة
- `src/hooks/useOffChannelCollections.js`
- `src/components/dashboard/PendingCollectionsCard.jsx`
- `src/pages/Dashboard.jsx` (ترتيب)
- `src/components/accounting/OffChannelMandatoryDialog.jsx` (لا تغيير منطقي، يستفيد من الـscope الجديد)
- `src/components/accounting/OffChannelOwnerInbox.jsx` (pagination + manager scope)
- Migration جديدة: حذف الوهمي + تعطيل auto-create + إعادة إرسال الإشعار.
