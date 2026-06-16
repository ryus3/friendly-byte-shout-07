## الخطة الكاملة — إصلاح الأرباح الحقيقية وتقرير المالكين

### 1. ربح الموظف الحقيقي (قاعدة + زيادة − خصم)
- التأكد من أن trigger `auto_create_profit_record` يحسب: `employee_profit = base_rule_profit + price_increase − discount` (يسمح بقيم سالبة).
- Back-fill لكل سجلات `profits` الموجودة بنفس المعادلة.
- في كرت الطلب داخل نافذة الفاتورة (`SettlementInvoiceDialog`) وفي `InvoiceProfitsTab` يُعرض الربح الحقيقي من `profits.employee_profit` (وليس من القاعدة الافتراضية).

### 2. دفع المستحقات وحركات النقد مبنية على الربح الحقيقي
- RPC `pay_employee_dues_with_invoice` يجمع المبلغ من `profits.employee_profit` الحقيقي (بعد الزيادة/الخصم) — لا يثق بأي قيمة قادمة من الواجهة.
- يُسجَّل المبلغ نفسه في:
  - `settlement_invoices.total_amount`
  - `cash_movements` (خصم من القاصة الرئيسية)
  - الإشعار للموظف
  - إحصائيات تقرير أرباح الفواتير

### 3. تقرير الأرباح والخسائر لمدير القسم المالك للمنتجات
حالياً يعرض الإيراد كاملاً كربح (9,004,000 = 9,004,000). الإصلاح:
- في `useUnifiedProfitCalculator` (والـ hooks المرتبطة) عند المستخدم غير الـ admin الذي يملك منتجات:
  - **إجمالي المبيعات** = مجموع `final_amount − delivery_fee` للطلبات المسلَّمة التي منتجاتها يملكها (`products.owner_user_id = user.id`).
  - **رسوم التوصيل** = مجموع `delivery_fee` لنفس الطلبات.
  - **تكلفة البضاعة المباعة** = مجموع `cost_price × quantity` لعناصر هذه الطلبات.
  - **مجمل الربح** = المبيعات − تكلفة البضاعة.
  - **مستحقات مدفوعة** = مجموع `settlement_invoices.total_amount` للفواتير التي صرفها هذا المالك (`settlement_owner_user_id = user.id`).
  - **مصاريف عامة** = `expenses` التي `created_by = user.id` (أو expenses الخاصة بنطاقه).
  - **صافي الربح** = مجمل الربح − المستحقات − المصاريف.
- كل الأرقام مبنية على الإيراد الحقيقي للطلب (`final_amount` بعد الزيادة/الخصم)، لا على افتراضات.

### 4. إخفاء التفاصيل عن غير المالكين في تقرير أرباح الفواتير
- في `InvoiceProfitsTab` و `invoiceProfitsCalc`:
  - الموظف العادي يرى فقط: ربحه الحقيقي، عدد طلباته، رقم التتبع.
  - لا يرى: تكلفة المنتجات، إيراد المالك، هامش المالك، تفاصيل المنتجات المالية.
  - يظهر `tracking_number` بدلاً من `order_number` كما طُلب.

### 5. منع الأخطاء الصامتة
- RPC الدفع يرفع `EXCEPTION` إذا فشلت أي خطوة (فاتورة بدون cash_movement أو بدون ربط طلبات = rollback كامل).
- إضافة self-healing: عند فتح فاتورة تسوية بدون `settlement_invoice_orders` أو بدون `cash_movements` يتم إعادة بنائها تلقائياً من بيانات الـ profits.

### تفاصيل تقنية
- **Migration واحد** يحتوي: تحديث trigger الربح + back-fill + إعادة كتابة `pay_employee_dues_with_invoice` (atomic) + self-heal function للفواتير القديمة.
- **ملفات الواجهة:**
  - `src/hooks/useUnifiedProfits.js` / `src/components/shared/UnifiedProfitCalculator.jsx` — منطق ربح المالك.
  - `src/components/accounting/ProfitLossDialog.jsx` — عرض الأرقام الجديدة للمالك.
  - `src/components/profits/SettlementInvoiceDialog.jsx` — كرت طلب يعرض ربح الموظف الحقيقي + tracking_number.
  - `src/components/orders/InvoiceProfitsTab.jsx` + `src/lib/invoiceProfitsCalc.js` — إخفاء تفاصيل المالك عن الموظف، استخدام الربح الحقيقي.
- **بدون لمس** توجيه الدومين (سيُحَل لاحقاً كما طلبت).

### النتيجة المتوقعة
- كرت طلب #147634199 يعرض: ربح الموظف = 6,000 (7,000 قاعدة − 2,000 خصم + 1,000 زيادة = 6,000 مثلاً، حسب الأرقام الفعلية)، وليس 7,000 افتراضياً.
- فاتورة التسوية تُصرف بنفس المبلغ الحقيقي وحركة النقد مطابقة.
- تقرير المدير المالك يعرض: مبيعات منتجاته فقط، تكلفتها، توصيلها، مستحقاته المدفوعة، مصاريفه، وصافي ربح حقيقي.
- الموظفون لا يرون أي تفاصيل مالية تخص المالك.
