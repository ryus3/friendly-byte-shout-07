## التشخيص المؤكد بالأرقام

### 1) المشكلة ليست من شركة التوصيل وحدها
- API يرجع بيانات أحياناً، لكن الكود الحالي يتعامل معها بطريقة تُفشل العرض والربط.
- فشل Edge Function يظهر في الواجهة كـ `non-2xx status code` لأن `smart-invoice-sync` يرجع 500 عند أي استثناء بدل أن يرجع نتيجة منظمة ويحافظ على الكاش.

### 2) قبل 27/4 كان الربط يعمل لأن الطلبات المسلّمة كانت تُعلّم بالفاتورة
فحص الطلبات المسلّمة للزبون `delivery_status = '4'`:

```text
قبل 27/4:
50 طلب مسلّم
50 لديهم delivery_partner_invoice_id
50 receipt_received = true

بعد 27/4:
106 طلب مسلّم
3 فقط لديهم delivery_partner_invoice_id
103 بدون فاتورة
3 فقط receipt_received = true
```

هذا هو الخلل الأساسي: مسار الفاتورة بعد 27/4 لم يعد يضع رقم الفاتورة على الطلب المحلي، لذلك لا يكتمل الربط ولا الاستلام المالي.

### 3) الفواتير الحديثة محفوظة لكن طلباتها ناقصة أو غير مرتبطة
أمثلة من قاعدة البيانات الآن:

```text
3358594: المفروض 69 طلب، المحفوظ 7، المرتبط 0
3343958: المفروض 43 طلب، المحفوظ 12، المرتبط 0
3319023: المفروض 45 طلب، المحفوظ 43، المرتبط 3
2618448 القديمة الصحيحة: محفوظ/مرتبط تقريباً بالكامل
```

سبب النقص: في نسخة 24/4 كان `smart-invoice-sync` يجلب طلبات الفاتورة ويعيد المحاولة عند نقص snapshot. الآن آلية retry معطّلة فعلياً داخل `if (false && !isReceived)`، لذلك أول رد جزئي من الوسيط يصبح هو الحقيقة المخزنة.

### 4) سبب اختفاء الفواتير في التبويب
- `AlWaseetInvoicesTab` يربط بداية التحميل بـ `isLoggedIn` الخاص بتوكن شركة التوصيل، وليس جلسة Supabase. لذلك يظهر كأن الحساب غير مسجل أو لا توجد فواتير إلى أن تضغط تحديث.
- `useAlWaseetInvoices.fetchInvoices` قد يستبدل الكاش بقائمة فارغة عند فشل/فلترة API، لذلك الفواتير تظهر ثم تختفي.

### 5) الحذف التلقائي الخاطئ مصدره مؤكد
ليس من `sync-order-updates` الحالي فقط. يوجد مسار في:

`src/contexts/AlWaseetContext.jsx`

- `syncAndApplyOrders()` يستدعي بعد المزامنة:
  `performDeletionPassAfterStatusSync()`
- هذا المسار حذف طلبات وسجّلها في `auto_delete_log` بمصدر:
  `delete_source = syncAndApplyOrders`
- أمثلة محذوفة فعلياً:
  `143136640`, `143114210`, `143010461`, `142898849`
- السجل يقول: `لم يُعثر على الطلب في شركة التوصيل (مؤكد من API)`، لكن هذا ليس تأكيداً كافياً لأن البحث يتم عبر مسار قد يفشل بسبب التوكن/القائمة/الحساب.

## خطة الإصلاح

### أولا: إيقاف الكارثة فوراً — منع الحذف التلقائي بالكامل
تعديل `src/contexts/AlWaseetContext.jsx`:
- منع `syncAndApplyOrders()` من استدعاء `performDeletionPassAfterStatusSync()`.
- جعل `performDeletionPassAfterStatusSync()` لا يحذف أي طلب نهائياً، فقط يسجل محاولة فحص آمنة إن لزم.
- الإبقاء على الحذف اليدوي فقط عبر `SuperProvider.deleteOrders` بشرطه الحالي: لا حذف إلا إذا التحقق القطعي نجح، وأي فشل API يمنع الحذف.

### ثانياً: إصلاح عرض تبويب الفواتير
تعديل `src/components/orders/AlWaseetInvoicesTab.jsx` و `src/hooks/useAlWaseetInvoices.js`:
- تحميل فواتير DB فوراً بناءً على جلسة Supabase `user.id` وليس `isLoggedIn` لتوكن شركة التوصيل.
- عدم مسح قائمة الفواتير أبداً إذا فشل API أو رجع فارغاً.
- زر تحديث يشغّل مزامنة صامتة ثم يعرض آخر كاش صحيح، لا يفرّغ الصفحة.

### ثالثاً: إرجاع منطق 24/4 لجلب طلبات الفواتير
تعديل `supabase/functions/smart-invoice-sync/index.ts`:
- إعادة تفعيل retry عند نقص عدد `delivery_invoice_orders` عن `orders_count`.
- retry يجب أن يعمل للفواتير المستلمة أيضاً، وليس فقط المعلقة.
- إن بقيت الفاتورة ناقصة، تحفظ الموجود ولا تضعها كأنها مكتملة.
- بعد كل جلب ناجح لطلبات فاتورة، تشغيل `link_invoice_orders_to_orders` مباشرة.

### رابعاً: إصلاح ربط الطلبات المسلّمة بالفواتير
تحديث دالة `link_invoice_orders_to_orders` عبر migration:
- الإبقاء على المطابقة الصارمة: tracking / qr / delivery_partner_order_id.
- إضافة طبقة آمنة للطلبات المسلّمة بعد 27/4:
  - نفس حساب التوصيل `delivery_account_used = account_username`
  - نفس الشريك
  - الطلب مسلّم `delivery_status = '4'`
  - داخل نافذة زمنية بعد تاريخ تسليم الطلب
  - مطابقة رقم التتبع إن وجد في `delivery_invoice_orders`
  - لا ربط بالهاتف/السعر إلا إذا كانت نتيجة واحدة 100% وغير متعارضة.
- تحديث `orders.delivery_partner_invoice_id` و `receipt_received` فقط عند الربط القطعي.

### خامساً: جعل Edge Function لا يكسر الواجهة
تعديل `smart-invoice-sync`:
- آخر `catch` يرجع `status: 200` مع `{ success:false, error }` بدلاً من 500.
- الواجهة تعرض الكاش وتُسجل الخطأ بصمت، بدون توست أحمر يكسر تجربة المستخدم.

### سادساً: تحقق بعد التنفيذ
بعد الإصلاح سأفحص هذه الأرقام مباشرة:

```text
3358594: saved يجب أن يقترب من 69، linked للطلبات المحلية فقط
3343958: saved يجب أن يقترب من 43، linked حسب الطلبات المحلية الموجودة
3319023: linked يجب أن يرتفع من 3
طلبات delivery_status=4 بعد 27/4 بدون delivery_partner_invoice_id يجب أن تنخفض جذرياً
أي auto_delete_log جديد من syncAndApplyOrders يجب أن يتوقف تماماً
```

## الملفات/الأجزاء التي ستتغير
- `src/contexts/AlWaseetContext.jsx`
- `src/components/orders/AlWaseetInvoicesTab.jsx`
- `src/hooks/useAlWaseetInvoices.js`
- `supabase/functions/smart-invoice-sync/index.ts`
- migration لتحديث `link_invoice_orders_to_orders` وربط الطلبات المسلّمة بأمان
