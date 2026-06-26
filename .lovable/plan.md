
## المشاكل المؤكدة بعد الفحص

### الفاتورة 3623484 (950k حقيقي مقابل 960k معروض)
- `delivery_invoices.amount` (الحقيقة من شركة التوصيل) = **950,000**
- مجموع `final_amount - delivery_fee` من جدول orders = **995,000**
- الواجهة تعرض 960,000 لأنها تستثني طلب الإرجاع (149776372) ثم تطرح أجور التوصيل
- السبب الجذري: `fetchInvoiceProfitsData` **لا تجلب** `dio.amount` أصلاً، فالحقل `o.invoice_order_amount` في `invoiceProfitsCalc.js` يكون دائماً 0 ويسقط fallback إلى `final_amount`
- الطلب 149922672 يُعرض 25,000 لأن `dio.amount` نفسها = 25,000 (لم تُحدَّث من شركة التوصيل بعد) — يجب أن نعرض ما تقوله الشركة فعلياً، فإن كان حقيقتها 0 فالمشكلة في المزامنة لا في الحساب
- الطلب 149776372 (return، `dio.amount = -20000`) يُستبعد كلياً من الإيراد — يجب أن يُحسب كسالب

### الفاتورة 3627296 (660k حقيقي مقابل 620k معروض)
- `delivery_invoices.amount` = **660,000**
- يحتوي طلب جزئي 149922265: `final_amount = 65,000`، `status = returned`، لكن `dio.amount = 45,000` (الشركة دفعت 40k بعد التوصيل)
- الكود يستبعده تماماً لأن status=returned، فيختفي إيراده ويصبح 620k
- الصحيح: استخدام `dio.amount` (45k − 5k = 40k) كإيراد فعلي للجزئي

### نافذة "حجز كميات" (الحالية مفتوحة لكل المنتجات)
- المالك أحمد يرى جميع المنتجات في النظام، وجميع موظفي النظام، وحجوزات موظفين تخص ملاك آخرين
- المطلوب: عرض منتجاته فقط (owner أو لديه صلاحية)، موظفيه فقط (الذين يشرف عليهم)، وحجوزات لمنتجاته فقط

---

## خطة العمل

### 1. توحيد الإيراد على `dio.amount` (مصدر الحقيقة الوحيد)

**أ. تحديث `fetchInvoiceProfitsData` في `src/lib/invoiceProfitsCalc.js`:**
- إضافة معامل `invoiceIds` لجلب صفوف `delivery_invoice_orders` (`order_id`, `amount`, `status`)
- بناء خريطة `order_id → dio.amount` ودمجها داخل صفوف orders كحقل `invoice_order_amount`
- جلب أيضاً `dio.status` لتحديد طلبات الإرجاع من جهة الشركة بدلاً من الاعتماد على `orders.status` وحده

**ب. تحديث `computeInvoiceProfits`:**
- إزالة `if (isReturn) return;` — الطلب الراجع يبقى داخل الحساب مع `realRevenue` سالب (= `dio.amount - delivery_fee`)
- إزالة fallback إلى `final_amount`: إذا كان `dio.amount` موجوداً نستخدمه دائماً (حتى لو كان 0 أو سالب). الـ fallback إلى `final_amount` يبقى فقط للطلبات غير المرتبطة بفاتورة
- معالجة الجزئي الذي status=returned: لو `dio.amount > 0` نعتبره مسلَّماً جزئياً (نشتقّ الكميات بنفس آلية `isPartialMissingData` الموجودة)
- عدد القطع: يُحسب فقط من `eligibleQty` لكل بند (الكميات المسلَّمة فعلياً)، ولن نضاعف عدّ بنود الراجع/غير المسلَّم

**ج. التكلفة والربح:**
- COGS = Σ (eligibleQty × cost) — تلقائياً سالب للراجع، صفر لغير المسلَّم
- الربح = realRevenue − COGS لكل طلب، يُجمَع للفاتورة
- delta (زيادة/خصم الموظف) = realRevenue − Σ(eligibleQty × unit_price) — تُخصم من ربح الموظف إن كان لديه قاعدة، وإلا توزَّع على الملاك

### 2. تفاصيل الفاتورة (تبويب "تفاصيل الفاتورة")
- إضافة شارة لكل طلب توضح: `خصم/زيادة` (delta ≠ 0)، `راجع` (dio < 0)، `جزئي` (status=partial أو returned مع dio>0)
- عرض المبلغ الحقيقي = `dio.amount` (مع لون مميز لو يختلف عن `final_amount`)
- ملف الواجهة المتأثر: `src/components/profits/InvoiceProfitsDialog.jsx` (أو ما يعادله)

### 3. نافذة حجز الكميات (`EmployeeReservationsDialog.jsx`)
- **قائمة المنتجات:** فلترة بـ `products.owner_user_id === currentUser.id` ∪ المنتجات التي يملك المستخدم صلاحية عليها عبر `user_product_permissions`
- **قائمة الموظفين:** فلترة بالموظفين الذين يشرف عليهم المالك من `employee_supervisors` (مع استثناء نفسه)
- المسؤول (admin) يرى الكل كما هو حالياً
- **الحجوزات النشطة:** استعلام `employee_product_reservations` مع join على `products` وفلترة `products.owner_user_id = currentUser.id` (للمسؤول: لا فلترة)

### 4. التحقق
- إعادة فتح الفاتورتين 3623484 و3627296 والتأكد أن الإيراد يطابق `delivery_invoices.amount` (950k و660k)
- التحقق أن الطلب 149922672 يظهر بمبلغه الحقيقي من شركة التوصيل، وأن أي تغيير لاحق في الشركة سيُحدَّث بعد المزامنة
- التحقق أن أحمد لا يرى منتجات/موظفي/حجوزات ملاك آخرين

## التفاصيل التقنية (للمراجعة)

**ملفات سيتم تعديلها:**
- `src/lib/invoiceProfitsCalc.js` — منطق الحساب والجلب
- `src/components/manage-employees/EmployeeReservationsDialog.jsx` — فلترة الملكية
- `src/components/profits/InvoiceProfitsDialog.jsx` (التبويب تفاصيل) — عرض شارات الخصم/الإرجاع/الجزئي

**لا تغييرات في قاعدة البيانات** — كل البيانات اللازمة (`delivery_invoice_orders.amount`/`status`, `order_items.quantity_delivered`, `products.owner_user_id`, `employee_supervisors`) موجودة فعلاً.

**لن يتم تغيير:** triggers الحجز/المخزون، منطق `profits` لكل طلب (يبقى حسب الموجود في DB، فقط طريقة العرض/التجميع تتغير).
