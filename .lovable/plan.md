## الهدف
1) إزالة إيموجي 🤖 البدائي من إشعارات الطلب الذكي ووضع أيقونة احترافية (AiOrderIcon) فقط.
2) تأكيد أن الإشعارات من مصدر واحد (جدول `notifications`) ويتم تحديث نفس السجل دون تكرار.
3) تأكيد أن كرت "طلبات الذكاء الاصطناعي" والرقم الخارجي يتحدثان لحظياً (Realtime) عند وصول طلب جديد، بدون تأخير، في `pos.ryusbrand.com`.

---

## 1) إزالة 🤖 بشكل جذري (Frontend + Backend + Legacy data)

**المشكلة:** الصورة المرفقة تُظهر `🤖` بجانب "(تليغرام)" لأن العنوان القديم محفوظ في DB يحتوي الإيموجي (تم إنشاؤه قبل الإصلاح السابق).

**الحل:**
- **Render-time stripping** في `NotificationsPanel.jsx` و `NotificationsPage.jsx`: عند عرض عنوان الإشعار من نوع `ai_order` / `new_ai_order`، نزيل الإيموجي 🤖 (وأي إيموجي روبوت بدائي) من النص قبل العرض. الأيقونة الاحترافية `AiOrderIcon` ستظهر يساراً وحدها.
- **Edge function** `ai-order-notifications/index.ts`: مؤكد بالفعل لا يضع 🤖. لا تغيير.
- **القوالب** `NotificationTemplates.jsx` و `PushNotificationControl.jsx`: استبدال `🤖` في القيم الافتراضية والـ placeholder بنص نظيف بدون إيموجي.

النتيجة: لا يظهر 🤖 في أي إشعار جديد أو قديم، فقط أيقونة `AiOrderIcon` الاحترافية المتدرجة.

---

## 2) تأكيد "مصدر واحد + تحديث نفس الإشعار"

**حالة النظام (تم في الجولة السابقة):**
- جدول `notifications` هو المصدر الوحيد.
- `sync-order-updates` edge function + `AlWaseetContext.createOrderStatusNotification` يستخدمان نفس منطق dedup: بحث خلال 7 أيام عن `alwaseet_status_change` بنفس `order_id`/`tracking_number` → إن وُجد بحالة مختلفة: UPDATE (يصبح `is_read=false`)، وإلا INSERT.
- `NotificationsContext` يحسب `is_read` من `read_at < updated_at`.
- Realtime يتعامل مع INSERT/UPDATE/DELETE محلياً بدون refetch.

**ما سنفعله للتأكيد:**
- مراجعة سريعة للكود للتأكد من عدم وجود مسار ثانٍ ينشئ إشعار حالة (لا triggers من DB، لا hooks مكررة).
- توثيق ذلك بتعليق واحد في رأس `createOrderStatusNotification` و `sync-order-updates` يوضح القاعدة (single source + same row update). لا تغيير سلوكي.

---

## 3) كرت "طلبات الذكاء الاصطناعي" — تحديث فوري

**الحالة الحالية:**
- `SuperProvider` يشترك بقناة realtime على جدول `ai_orders` ويعالج INSERT/UPDATE/DELETE محلياً (`prev.aiOrders` mutation).
- `stats.aiOrdersCount` مشتق من `aiOrders.length` → يتحدث تلقائياً.
- `useInstantNotifications` يضمن وصول الإشعار في نفس اللحظة.

**ما سنفعله:**
- التأكد أن `ai_orders` مُضاف لـ `supabase_realtime` publication و `REPLICA IDENTITY FULL` (إن لم يكن).
- إن لم يكن: migration بسيط لتفعيلهما → يضمن وصول INSERT لحظياً على `pos.ryusbrand.com` بدون انتظار polling.
- لا تغيير في UI؛ الكرت + الرقم الخارجي يحدّثان نفسهما تلقائياً من حالة `aiOrders`.

---

## الملفات المتأثرة
- `src/components/NotificationsPanel.jsx` — تنظيف العنوان من 🤖 عند العرض
- `src/pages/NotificationsPage.jsx` — نفس الشيء
- `src/pages/NotificationTemplates.jsx` — إزالة 🤖 من القوالب الافتراضية
- `src/pages/PushNotificationControl.jsx` — إزالة 🤖 من تسميات القنوات
- `src/contexts/AlWaseetContext.jsx` — تعليق توثيقي (بدون تغيير سلوكي)
- `supabase/functions/sync-order-updates/index.ts` — تعليق توثيقي
- Migration (شرطي): تفعيل realtime لـ `ai_orders` إن لم يكن مفعّلاً

---

## التحقق بعد التنفيذ
1) فتح لوحة الإشعارات → التأكد أن إشعارات "طلب ذكي" تظهر بدون 🤖، فقط الأيقونة الاحترافية.
2) إنشاء طلب ذكي عبر التليغرام → التأكد من ظهور الكرت + زيادة الرقم الخارجي خلال أقل من ثانية على `pos.ryusbrand.com`.
3) تغيير حالة طلب الوسيط مرتين → التأكد أن نفس صف الإشعار يُحدَّث (لا تكرار)، ويصبح غير مقروء بعد كل تغيير.
