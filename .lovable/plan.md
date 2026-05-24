## ما اكتشفته

- مصدر إشعار "تم تحديث حالة الطلب" المنبثق في المنتصف هو `src/pages/OrdersPage.jsx` (السطور 196-236): توست realtime يظهر مع كل تحديث حالة في جدول `orders` ومع كل ربط `delivery_partner_order_id`. ليس من `OrdersSyncProgress`.
- الفاتورة 3406747 فعلاً 49 طلباً في raw، لكن المحفوظ في `delivery_invoice_orders` 14 فقط، والمربوط محلياً طلب واحد. سجلات `smart-invoice-sync` تُظهر ضرب حد `errNum:2` (Rate Limit) وأحياناً `WORKER_RESOURCE_LIMIT` أثناء المعالجة الشاملة، فيتوقف قبل إكمال الكاش، ولأن `raw.id = 142...` بينما الطلب المحلي يعتمد `tracking_number = 143...`، فحتى السطور المحفوظة لا تُربط بدون خريطة `merchant-orders`.

## الخطة (تنفيذ كامل)

### 1) إزالة التنبيه المزعج
- حذف بلوك UPDATE toast في `OrdersPage.jsx` (تحديث الحالة + ربط معرف التوصيل) — الإشعارات الرسمية تأتي من `NotificationsHandler` فقط.

### 2) إشعار الطلب الذكي مميّز بتدرّج
- في `NotificationsPanel.jsx`، استبدال الشريط الجانبي الثابت لإشعارات `ai_order/new_ai_order` بتدرّج بنفسجي/نيلي/وردي ثابت (بدون animation ثقيل) مع الحفاظ على نفس الارتفاع والمسافات تماماً كباقي الإشعارات.

### 3) إصلاح جذري لجلب الفاتورة وربطها
- داخل `supabase/functions/smart-invoice-sync/index.ts`:
  - تشغيل الوضع الموجّه (`target_invoice_external_id`) دائماً عند فتح فاتورة من الواجهة، مع `force_refresh=true` إذا الكاش ناقص.
  - بناء `merchant-orders index` لكل توكن لإثراء كل `delivery_invoice_orders` بـ `tracking_number` و `qr_id` الحقيقيين، حتى يصبح الربط 100% بدون هاتف.
  - عدم رفع `orders_last_synced_at` إلا عند اكتمال الكاش فعلياً.
  - تقليل ضغط `comprehensive`: تخطي الفواتير المستلمة المكتملة، وفجوات أطول، وإيقاف فوري عند `errNum:2`.
- migration:
  - تحديث دالة `link_invoice_orders_to_orders` للاعتماد فقط على `tracking_number/qr_id/delivery_partner_order_id` + الشريط + الحساب.
  - تصفير `orders_last_synced_at` للفواتير الناقصة (cached < orders_count).
  - تشغيل الربط مرة واحدة لإصلاح المتراكم.

### 4) ثورة تصميمية لنافذة تفاصيل الفاتورة
- `AlWaseetInvoiceDetailsDialog.jsx`: 
  - رأس مع الحالة، الحساب، شريط اكتمال (cached/expected).
  - بطاقات أرقام دقيقة: مبلغ، عدد شركة التوصيل، محفوظ، مرتبط.
  - قسم "الطلبات المحلية المرتبطة" بتصميم timeline أنيق: رقم التتبع كعنصر رئيسي، اسم/هاتف، مبلغ، حالة الربط — بدون الحقول التقليدية.
  - قسم "طلبات شركة التوصيل" يعرض المحفوظ فقط، مع Badge "مرتبط/بانتظار الربط".
  - بدون كتابة "الحالة: …" ولا الـ raw status.
  - استخدام semantic tokens فقط.

### 5) ثورة تصميمية لكروت لوحة التحكم
- `src/components/dashboard/TopPerformanceCards.jsx`: إعادة بناء كروت العملاء/المحافظات/المنتجات بأسلوب ranking عالمي:
  - رقم كبير مع أيقونة gradient، شريط مساهمة دقيق، صفوف بـ hover خفيف.
  - رتب 1/2/3 بتاج/ميدالية ملوّنة دقيقة (بدون orbs ثقيلة).
- تنبيهات المخزون: تحسين الكرت الموجود بنفس النمط لو لزم (سأفحصه عند التنفيذ).

### 6) التحقق بعد التنفيذ
- فحص الفاتورة 3406747 مباشرة من قاعدة البيانات: expected/cached/linked.
- التأكد من عدم ظهور التوست المزعج عند الدخول لمتابعة الطلبات.
- مراجعة لقطة نافذة الفواتير الجديدة.

## الملفات المتأثرة
- `src/pages/OrdersPage.jsx`
- `src/components/NotificationsPanel.jsx`
- `src/components/orders/AlWaseetInvoiceDetailsDialog.jsx`
- `src/hooks/useAlWaseetInvoices.js`
- `src/components/dashboard/TopPerformanceCards.jsx`
- `supabase/functions/smart-invoice-sync/index.ts`
- migration واحدة: تحديث `link_invoice_orders_to_orders` + تصفير الكاش الناقص + إعادة الربط.