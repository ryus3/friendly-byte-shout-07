
# الخطة النهائية — نظام إشعارات عالمي موحّد

## التشخيص الفعلي (من فحص الكود والـ DB)

1. **آخر إشعار `alwaseet_status_change` كان في 2026-05-23 15:00** — رغم أن المزامنة التلقائية ركضت بعدها (20:58) ومستخدمون ضغطوا "تحقق الآن" على طلبات وتحديثوا حالاتها فعلياً.

2. **السبب الجذري:** في `src/contexts/AlWaseetContext.jsx` (سطر 1809) دالة `createOrderStatusNotification` **مُعطّلة بالكامل** (تعيد `return;` فوراً). أي:
   - زر الهيدر الدوار → يحدّث الحالة في DB لكن **لا يُنشئ إشعاراً**.
   - دخول صفحة الطلبات/متابعة الموظفين (`syncVisibleOrdersBatch`) → نفس الشيء.
   - زر "تحقق الآن" داخل تفاصيل الطلب → نفس الشيء.
   - فقط **cron الخلفي** عبر edge function `sync-order-updates` يُنشئ إشعارات — وهذا يعمل ضمن ساعات 08-20 بغداد فقط، ولفئة محدودة من الطلبات في كل دورة.

   النتيجة: المستخدم يرى الحالة تتغير في الواجهة لكن **بدون أي إشعار**.

3. **أيقونة "🤖" في عنوان الإشعار:** في `supabase/functions/ai-order-notifications/index.ts` السطر 81-83 يُكتب العنوان بـ `🤖 طلب ذكي جديد...` (emoji نصّي داخل العنوان). هذا هو ما يراه المستخدم في الـ screenshot — بجانب الأيقونة الاحترافية الجديدة (الدماغ المتدرّج) الموجودة بالفعل في `NotificationsPanel.jsx`. النتيجة: ازدواجية بصرية بدائية.

4. **`AiOrderCard.jsx`** (سطر 7، 74) لا يزال يستخدم `Bot` من lucide-react لمصدر `ai_assistant`/`ai_chat`، وليس الأيقونة الاحترافية.

## التغييرات المطلوبة

### 1) المصدر الموحّد لإشعارات تغيير الحالة (Source of Truth)

نُنشئ دالة موحّدة `upsertAlwaseetStatusNotification({ orderId, userId, trackingNumber, oldState, newState, statusText, city, province, account, priority })` داخل `AlWaseetContext.jsx` تطبّق **نفس منطق dedup الموجود في edge function** بالضبط:

```text
1. ابحث عن notification type='alwaseet_status_change' لنفس user_id خلال آخر 7 أيام
2. fitler يدوي: data.order_id === orderId || data.tracking_number === trackingNumber
3. إذا وُجد ونفس state_id → return (تخطي تام)
4. إذا وُجد وحالة مختلفة → update (is_read=false, created_at=now, message/title/data جديدة)
5. إذا لم يوجد → insert جديد
```

العنوان والرسالة بنفس صيغة edge function: `"${city} - ${province} | ${statusText}"` و `"${statusText} ${tracking_number}"`.

### 2) تفعيل المصدر الموحّد في جميع نقاط مزامنة العميل

كل موضع داخل `AlWaseetContext.jsx` يكتشف فيه تغيّر `delivery_status` لطلب يجب أن يستدعي `upsertAlwaseetStatusNotification` بعد نجاح `UPDATE orders`:
- داخل `syncVisibleOrdersBatch` (المزامنة عند فتح الصفحات + الزر الدوار).
- داخل `forceSyncSingleOrder` (زر "تحقق الآن").
- داخل أي حلقة `for localOrder of …` تكتشف `localOrder.status !== newStatus` (حول السطر 1180).

نحذف الـ `return;` المبكّر من `createOrderStatusNotification` ونجعلها alias رفيع للدالة الموحّدة.

### 3) منع التكرار مع edge function (cron)

ما دامت كل من العميل والـ edge function تستعمل **نفس** قاعدة dedup (search + same state → skip) على **نفس** الحقول (`type='alwaseet_status_change'`, `user_id`, `data.order_id`)، لن يحدث تكرار. أول من يصل يُنشئ، الباقي يُحدِّث أو يتخطّى.

### 4) إزالة الـ 🤖 من العنوان النصّي

في `supabase/functions/ai-order-notifications/index.ts`:
- حذف `const sourceEmoji = '🤖';`
- العنوان يصبح: `طلب ذكي جديد من ${creatorName} (${sourceLabel})` — بدون emoji.
- الاعتماد على `AiOrderIcon` (الدماغ المتدرّج) الذي يعرضه `NotificationsPanel.jsx` تلقائياً عبر `iconMap[type='new_ai_order']`.

### 5) استبدال أيقونة `Bot` في `AiOrderCard.jsx`

- استيراد `AiOrderIcon` من `@/components/icons/AiOrderIcon`.
- استبدال `icon: Bot` في `getSourceIcon` (سطر 74) لمصادر `ai_chat`/`ai_assistant` بـ `AiOrderIcon`.
- إبقاء `Send` للتليغرام (مناسب) و `Smartphone` للويب.

### 6) صفحة الإشعارات `NotificationsPage` و `NotificationsPanel`

- لا تغيير منطقي: يستخدمان `iconMap` الموحّد الذي يربط `new_ai_order` و `ai_order` بـ `AiOrderIcon` (موجود بالفعل).
- التأكد فقط أن `NotificationsHandler.jsx` يستخدم الأيقونة الجديدة عند عرض toast فوري للطلبات الذكية بدلاً من emoji.

## الملفات التي ستُعدَّل (5 ملفات فقط)

| الملف | التغيير |
|------|---------|
| `src/contexts/AlWaseetContext.jsx` | إضافة `upsertAlwaseetStatusNotification` موحّدة + استدعاؤها في كل مكان يتغيّر فيه `delivery_status` (3 مواضع داخل `syncVisibleOrdersBatch` و `forceSyncSingleOrder`). |
| `supabase/functions/ai-order-notifications/index.ts` | حذف `sourceEmoji='🤖'` من العنوان. |
| `src/components/dashboard/AiOrderCard.jsx` | استبدال `Bot` بـ `AiOrderIcon` لمصادر `ai_*`. |
| `src/contexts/NotificationsHandler.jsx` | تأكيد استخدام أيقونة احترافية في toast (إن استعمل emoji). |
| `src/utils/NotificationService.js` | إزالة أي 🤖 emoji من عناوين الإشعارات الموحدة (السطر 154 المنطقة). |

## ضمانات النهائية ("عالمية كالمواقع الكبرى")

- **مصدر واحد للحقيقة:** نفس دالة dedup منطقياً بين العميل وedge function → لا تكرار أبداً.
- **التحديث في المكان:** الإشعار نفسه يُحدَّث ويصبح `is_read=false` عند تغيّر الحالة الفعلي — كما في Slack/Linear.
- **بدون استدعاءات زائدة:** لا realtime parallel channels، لا dispatch زائدة — فقط استعلام-تحديث/إدراج واحد لكل تغيّر حالة فعلي.
- **جاهز للتطبيق الحقيقي:** الإشعارات في DB → القناة الموجودة في `NotificationsContext` تلتقطها realtime → push notification (في التطبيق المستقبلي) يُغذّى من نفس السجل.

## ما لن نلمسه

- لا تغيير على قاعدة البيانات.
- لا تغيير على منطق المزامنة نفسه ولا فلاتر الاستبعاد.
- لا تغيير على `AiOrderIcon` (موجودة وممتازة).
- لا triggers جديدة.
