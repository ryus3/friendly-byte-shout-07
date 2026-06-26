## نتائج الفحص (مصدر الحقيقة)

- **أنواع الطلبات الموجودة فعلياً في الكود**: `regular` (عادي) و `return` (إرجاع) و `replacement`/`exchange` (استبدال) و `partial_delivery` (تسليم جزئي).
- **في قاعدة البيانات الآن**: لا توجد سجلات `return` ولا `replacement` — كلها انقلبت إلى `regular` أو `partial_delivery`.
- **سبب الكارثة**: دالة المزامنة الخلفية `supabase/functions/sync-order-updates/index.ts` تحوّل أي طلب عند حالة الوسيط 21 إلى `partial_delivery` بدون التحقق من نوعه الأصلي. الواجهة `AlWaseetContext.jsx` فيها حماية، لكن الخادم لا.
- **الطلب 149776372** أُنشئ كإرجاع (`refund_amount=20000`، الملاحظات تقول "إرجاع: ماروني"، أصله `total_amount=-25000`) ثم المزامنة قلبته إلى `partial_delivery` بمبلغ موجب 25,000 وخصم وهمي 45,000.
- **خطأ البناء الحالي**: تكرار سطر `isOwnerOrAdmin` في `ManageProductsPage.jsx:46` — يجب إصلاحه أولاً.

## الخطة الكاملة

### 1) إصلاح خطأ البناء فوراً
- استبدال السطر المكسور 46 في `src/pages/ManageProductsPage.jsx` بسطر واحد نظيف:
  - يظهر الزر للمدير العام، مدير القسم، ولأي مستخدم يملك ولو منتجاً واحداً (`owner_user_id === uid`).
  - دعم كل من `user.id` و `user.user_id`.

### 2) حماية نوع الطلب في المزامنة الخلفية (المصدر الجذري)
تعديل `supabase/functions/sync-order-updates/index.ts`:
- إنشاء قائمة محمية: `['return', 'replacement', 'exchange', 'partial_delivery']`.
- عند الحالة 21: لا يتم تحويل النوع إلى `partial_delivery` إلا إذا كان النوع الحالي `regular` فقط.
- عند الحالة 17: لا يتم لمس طلبات الإرجاع/الاستبدال.
- مزامنة السعر: تسمح بالتحديث للطلبات العادية والتسليم الجزئي. لطلبات **الإرجاع** نحافظ على المبلغ سالباً (`total_amount` و `final_amount`) ونزامن فقط `delivery_fee` و `delivery_status` — لأن سعر الوسيط لطلب الإرجاع هو رسوم التوصيل وليس سعر منتج. لطلبات **الاستبدال** نزامن فرق السعر فقط.

### 3) إصلاح الطلب 149776372 وأي طلب إرجاع تضرر
في نفس migration:
- إعادة الطلبات التي ملاحظاتها تبدأ بـ "إرجاع" والتي تحولت قسرياً إلى `partial_delivery`:
  - `order_type = 'return'`
  - `is_partial_delivery = false`
  - `final_amount = -refund_amount`
  - `total_amount = -refund_amount`
  - `sales_amount = 0`
  - `discount = 0`
  - `price_increase = 0`
  - `price_change_type = null`
- نفس الإصلاح لطلبات الاستبدال إذا تأثرت.

### 4) منع فتح نافذة "تحديد المنتجات المُسلّمة" لطلبات الإرجاع
في `src/components/orders/OrderCard.jsx`:
- توسيع شرط الاستثناء بحيث أي طلب نوعه `return` أو `refund_amount > 0` أو `final_amount < 0` لا يُعرض له زر التسليم الجزئي ولا تُفتح النافذة تلقائياً.

### 5) إظهار زر "حجز كميات للموظفين" لكل مالك منتج
- التحقق في `ManageProductsPage` يصبح: مالك المنتج = أي منتج فيه `owner_user_id` يطابق `user.id` أو `user.user_id`.
- إضافة `!loading` لتجنب الحكم قبل تحميل المنتجات.

### 6) إصلاح القوائم المنسدلة (اختر الموظفين / اختر المنتجات)
في `src/components/manage-employees/EmployeeReservationsDialog.jsx`:
- `PopoverContent`: إضافة `z-[100]`، ارتفاع محدد، خلفية `bg-popover` صلبة بدون شفافية شديدة، `collisionPadding`.
- استبدال `ScrollArea` بـ `div` بسيط مع `overflow-y-auto`, `overscroll-contain`, `touch-pan-y`, `max-h-[55vh]` لضمان السكرول على الموبايل.
- جعل القائمة دائماً فوق النافذة عبر `Portal` من Radix (موجود) + `z-index` صحيح.

### 7) إعادة تصميم نافذة حجز الكميات بألوان واضحة (مثل تقرير أرباح الفواتير)
- إزالة الحدود النيون المتحركة (`conic-gradient` المتحرك) نهائياً.
- إزالة الكرات الضبابية المتحركة (`animate-pulse`).
- استبدال الخلفية بـ:
  - خلفية `bg-background` صلبة.
  - رأس بتدرج هادئ احترافي مماثل لـ `AlWaseetInvoiceDetailsDialog` (تدرج primary خفيف + كرات ضبابية ثابتة).
  - بطاقات داخلية واضحة بحدود `border-border` وخلفية `bg-card`.
  - أزرار `+` و `-` دائرية بألوان primary واضحة.
  - زر "حجز الكل" بتدرج primary→accent ثابت.
- المحافظة على نفس الوظائف بدون تغيير منطقي.

### 8) التحقق بعد التنفيذ
- التحقق بقاعدة البيانات أن `149776372` رجع `return` بمبلغ سالب صحيح.
- التحقق أن البناء ينجح.
- التحقق أن الزر يظهر للمالكين.
- التحقق أن القوائم تفتح فوق النافذة وتنزلق.

## التقنيات

- **Edge Function**: `supabase/functions/sync-order-updates/index.ts` — حماية النوع وشروط مزامنة السعر حسب النوع.
- **Migration**: تصحيح بيانات الطلبات التالفة (UPDATE فقط، بدون تغيير schema).
- **Frontend**:
  - `src/pages/ManageProductsPage.jsx` — إصلاح البناء + ظهور الزر.
  - `src/components/orders/OrderCard.jsx` — حماية ضد فتح نافذة التسليم الجزئي للإرجاع.
  - `src/components/manage-employees/EmployeeReservationsDialog.jsx` — إعادة تصميم + إصلاح Popover.