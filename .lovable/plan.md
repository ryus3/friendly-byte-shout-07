## ما اكتشفتُه من فحص النظام الحالي

1. **الإعداد صحيح**: `ai_approval_send_as = 'creator'` موجود بالفعل.
2. **حسابات شركة التوصيل صحيحة في DB**:
   - سارة احمد → `ryusiq` (افتراضي، نشط).
   - المدير العام → `alshmry94` (افتراضي، نشط).
3. **سبب رسالة الفشل بالصورة**: واجهة المدير العام تفرض اختياره `selectedAccount='alshmry94'` على طلب سارة. `approveAiOrder` يأخذ هذا الحساب ويبحث عنه تحت `created_by = سارة`، فلا يجده، فيظهر الخطأ. الكود لا يتجاهل اختيار المدير عندما يكون منشئ الطلب موظفاً آخر — وهذا يخالف الاتفاق.
4. **`getTokenForUser` يفلتر `expires_at > now()`** ويُستخدم لاحتساب حالة الاتصال — قد يعطي نتائج خاطئة ويُسبب فشل عشوائي.
5. **الأرباح في الفواتير**: النظام يحتوي أصلاً على `order_discounts` (مع `affects_employee_profit`) وحركات نقد بالسعر النهائي. التبويب الحالي يحسب الإيراد من `final_amount - delivery_fee` (صحيح)، لكنه لا يستفيد من `order_discounts` لتوزيع الزيادة/الخصم بدقة على الموظف أو مالك المنتج.
6. **الإشعارات**: `ai-order-notifications` تُدرج إشعاراً عاماً بـ `user_id = null` للمدير العام. منطق `useUnreadNotificationsCheck` يسمح لغير الأدمن برؤية بعض إشعارات `user_id = null`، وهذا قد يُسرّب إشعارات المدير العام إلى مدير القسم.

## التنفيذ المطلوب

### 1) موافقة الطلب الذكي — صحيحة 100٪، بدون افتراضات خاطئة

`src/contexts/SuperProvider.jsx` → `approveAiOrder`:

- تعريف ثابت في بداية الدالة:
  ```text
  ownerId   = aiOrder.created_by
  approverId = current user
  deliveryUserId = (setting == 'creator') ? ownerId : approverId
  ```
- **تجاهل `selectedAccount` إذا كان لا يخص `deliveryUserId`**:
  ```text
  if selectedAccount مرسل:
    تحقق وجود صف delivery_partner_tokens
      للمستخدم deliveryUserId + الشريك + هذا الحساب (is_active=true)
    لو موجود → استخدمه.
    لو غير موجود → تجاهله تماماً (لا تُفشل، لا تُحذّر) وانتقل للخطوة التالية.
  ```
- **اختيار الحساب التلقائي عندما لا يوجد حساب صالح ممرر**:
  1. `profiles.selected_delivery_account` لـ `deliveryUserId` إذا كان `selected_delivery_partner = destination`.
  2. الحساب الافتراضي النشط للمنشئ في هذا الشريك.
  3. أحدث حساب نشط للمنشئ في هذا الشريك.
- **جلب التوكن**: قراءة مباشرة من `delivery_partner_tokens` بدون فلتر `expires_at`.
- **التعامل مع `TOKEN_EXPIRED`**: التجديد التلقائي الموجود يبقى كما هو.
- **رسالة الفشل الواضحة** عند عدم وجود أي حساب للمنشئ:
  > "الموظف {اسم المنشئ} ليس لديه حساب نشط في شركة {الشريك}. سجّل دخوله من إدارة شركات التوصيل."
- **حفظ الطلب المحلي**:
  - `created_by = ownerId`
  - `delivery_account_used = الحساب الذي نجح فعلياً`

`src/components/dashboard/AiOrderCard.jsx` و `AiOrdersManager.jsx`:
- إزالة الشرط "يجب تحديد حساب شركة التوصيل" عند الموافقة على طلب منشئه ليس المستخدم الحالي. التحقق ينتقل إلى الخادم/المنطق الذي يختار حساب المنشئ تلقائياً.

`src/contexts/AlWaseetContext.jsx` → `getTokenForUser`:
- إزالة `.gt('expires_at', new Date().toISOString())` من الجلب الأساسي. الاعتماد على رد الشريك.

### 2) أرباح/مستحقات الفاتورة — استخدام الموجود فقط، بدون أي حسابات جديدة

`src/components/orders/InvoiceProfitsTab.jsx`:

- مصدر الإيراد لكل طلب يبقى:
  ```text
  realRevenue = final_amount - delivery_fee
  ```
  (هذا أصلاً يعكس الزيادة والخصم لأن `cash_movements` تستخدم نفس المبدأ).
- مصدر تكلفة وكميات المنتجات: `order_items` كما هو.
- مستحقات كل موظف لكل طلب: من `profits.employee_profit` كما هي (تشمل الزيادة المؤهلة عبر `employee_profit_rules` كما يعالجها النظام حالياً).
- **إضافة استعلام واحد** على `order_discounts` بنفس `order_id`s لقراءة:
  - `discount_amount` (سالب = زيادة، موجب = خصم)
  - `affects_employee_profit`
  - `employee_id`
- التوزيع بسيط بدون نموذج جديد:
  - **زيادة** (`discount_amount < 0` و `affects_employee_profit = true`):
    تُضاف إلى مستحقات الموظف المعني في عرض الفاتورة (مرئية بوضوح كسطر "زيادة سعر").
  - **زيادة** (`affects_employee_profit = false`):
    تُضاف إلى صافي ربح مالك المنتج المرتبط (إيراد المالك + الزيادة).
  - **خصم** (`discount_amount > 0`):
    يُطرح من ربح مالك المنتج، ومن مستحقات الموظف فقط إذا `affects_employee_profit = true`.
- العرض النهائي يصبح موحَّداً:
  - إجمالي الإيراد بدون توصيل = مجموع `realRevenue` (يحتوي الزيادة/الخصم تلقائياً).
  - مستحقات كل موظف = `profits.employee_profit` + زيادات مؤهلة − خصومات مؤهلة.
  - صافي كل مالك منتج = (إيراد منتجاته بسعر الوحدة × الكميات) − تكلفته + حصته من الزيادة − حصته من الخصم، ضمن نفس مجموع الإيراد الحقيقي.
- مدير القسم: يرى فقط موظفيه ومنتجاته (بدون تغيير).

النتيجة: لا جداول جديدة، لا حقول جديدة، نفس المصادر — فقط استخدام `order_discounts` الموجود لعرض دقيق لكل طلب داخل الفاتورة.

### 3) الإشعارات — منع تسرّب إشعارات المدير العام إلى مدير القسم

`supabase/functions/ai-order-notifications/index.ts`:
- بدلاً من إدراج إشعار واحد `user_id = null`، يُدرج إشعار لكل `user_id` فعلي يحمل دور `super_admin` أو `admin`.
- يبقى منع إرسال إشعار للمشرفين إذا كان المنشئ أدمن (موجود بالفعل، نتأكد من بقائه).

`src/hooks/useUnreadNotificationsCheck.js`:
- لغير الأدمن: لا نُظهر أي إشعار بـ `user_id = null`. الحصر على `user_id = user.id` فقط.

`src/contexts/NotificationsContext.jsx`:
- `canSeeNotification`: لغير الأدمن، إشعارات `user_id = null` لا تُعرض (الاستثناء فقط للإشعارات الموجَّهة بصراحة عبر `user_id` للمستخدم نفسه أو لموظف يشرف عليه).

## التحقق بعد التنفيذ

- موافقة المدير العام على طلب سارة → الطلب يُرسل لـ `ryusiq`، يُحفظ محلياً بـ `created_by = سارة`، `delivery_account_used = ryusiq`. لا فشل.
- موافقة المدير العام على طلبه → يُرسل لـ `alshmry94` بدون أخطاء.
- فاتورة فيها طلب بسعر 19 + توصيل 5 ومدفوع 25:
  - الإيراد الحقيقي = 20 (السعر الحقيقي بدون توصيل).
  - الزيادة (1) تظهر للموظف صاحب القاعدة أو لمالك المنتج حسب `order_discounts.affects_employee_profit`.
- إشعار طلب ذكي للمدير العام لا يصل لمدير القسم.

## الملفات المعدّلة

- `src/contexts/SuperProvider.jsx`
- `src/contexts/AlWaseetContext.jsx`
- `src/components/dashboard/AiOrderCard.jsx`
- `src/components/dashboard/AiOrdersManager.jsx`
- `src/components/orders/InvoiceProfitsTab.jsx`
- `src/hooks/useUnreadNotificationsCheck.js`
- `src/contexts/NotificationsContext.jsx`
- `supabase/functions/ai-order-notifications/index.ts`