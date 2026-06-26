القواعد المعتمدة بدقة (متفق عليها)

1. كل طلب يحتفظ بـ delta حقيقي خاص به: زيادة الوسيط تُسجَّل في طلبها، الخصم يُسجَّل في طلبه. لا تقاصّ على مستوى الطلب.
2. ربح الموظف لكل طلب رياضياً = `employee_rule_base_order + delta_order` (إن كان لديه قاعدة فعّالة). هذه هي القيمة المخزّنة في `profits.employee_profit` وهي صحيحة كما هي.
3. كرت "مستحقات الموظفين" في الفاتورة يعرض **مجموع قواعد الربح فقط** (84,000 لفاتورة 3612243) دون مجموع الـ delta، لأن الـ delta معروض بالأعلى كبطاقات "زيادة/خصم".
4. صافي المالكين = إيراد الفاتورة الحقيقي − التكلفة − **مجموع قواعد ربح الموظف فقط** (بدون أي delta) = 240,000 − 144,000 − 84,000 = **12,000** للفاتورة 3612243.
5. الإيراد والتكلفة والأرباح لكل طلب تُحسب من الإيراد الحقيقي للطلب (`final_amount − delivery_fee`)، لا من المخطط.
6. للموظف بدون قاعدة ربح، يبقى الـ delta موزَّعاً نسبياً على إيرادات منتجات الطلب (سلوك حالي).

الخطة الكاملة

1) `src/lib/invoiceProfitsCalc.js` — فصل base/delta عبر الفاتورة
- لكل طلب: حساب `delta_order = real_revenue_order − planned_items_revenue_order`.
- استخراج `employee_rule_base_order` من جدول `employee_profit_rules` للموظف وقت إنشاء الطلب (يدعم زمن صلاحية القواعد كما في memory).
- `employeeBaseTotal = Σ employee_rule_base_order` (لكل الطلبات).
- `employeeDeltaNet = Σ delta_order للموظفين أصحاب القواعد` (قد يكون موجباً/سالباً/صفراً).
- بطاقة "مستحقات الموظفين" تعرض `employeeBaseTotal` (84,000) مع سطر فرعي اختياري: "زيادات +20,000 / خصومات −20,000 / صافي 0".
- `byOwner.net = ownedRevenue_real − ownedCost − ownedEmployeeBase` (بدون delta).
- `netForOwners = totalRevenueReal − totalCost − employeeBaseTotal` (= 12,000).
- لا تغيير على بطاقات الزيادة/الخصم العلوية — تبقى كما تظهر.

2) `src/components/orders/InvoiceProfitsTab.jsx` و`RevenueSplitCard`
- إضافة `pre_discount_channel_revenue = channel_real + Σ|delta_negative| + returnsTotalLoss`.
- بطاقة "المفروض قبل الخصم" تستخدم هذه القيمة (تظهر 980,000 لفاتورة 3623484 بدل 950,000).
- تظهر تفصيلة: "من شركة التوصيل"، "المفروض قبل الخصم"، "خصم الوسيط"، "إرجاعات"، "تحصيلات خارج القناة المؤكَّدة".

3) إصلاح خطأ `column "is_main" does not exist` عند تأكيد التحصيل
- ترحيل DB يستبدل دالة `public.create_off_channel_cash_movement_on_settle`:
  - إزالة كل إشارة لـ `is_main`.
  - اختيار القاصة: قاصة المالك النشطة `owner_user_id = NEW.owner_user_id` → القاصة الرئيسية النشطة `owner_user_id IS NULL` → أي قاصة نشطة.
  - إدراج `cash_movements` واحدة بنوع `off_channel_receipt` ومرجع `off_channel_collection:{id}`.
  - الاعتماد على تريغر مزامنة الرصيد الموجود (بدون تحديث يدوي يسبب ازدواج).
- نتيجة: ضغطة "استلمت" تنجح من أول مرة، وحركة نقدية واحدة صحيحة في قاصة المالك.

4) إعادة احتساب الأرباح للفواتير المتأثرة (آمن، بدون تغيير دوال)
- استدعاء `calculate_real_employee_profit_for_order` لكل طلب في 3612243 و3623484 لإعادة بناء `profits.employee_profit` المخزّن (لو احتاج).
- لا تغيير هيكلي على دوال الأرباح.

5) موافقة المدير العام على الطلب الذكي
- المشكلة عند المدير (وليس "أحمد"): كثير من الطلبات الذكية تحمل `created_by` غير UUID صالح أو لموظف آخر، فتفشل استعلامات `delivery_partner_tokens/profiles` بـ "invalid input syntax for type uuid" ويعلق الزر.
- إصلاح `src/contexts/SuperProvider.jsx`:
  - دالة `resolveOwnerForAiOrder(order)` ترجع UUID صالحاً عبر: `created_by` إن كان UUID → ربط بـ `employee_code/telegram_code/username` من `profiles` → السقوط على `approverId` (المدير الحالي).
  - استخدام هذا الـ UUID في كل استعلامات الموافقة (التوكن، القاصة، ربط الطلب الناتج).
- إصلاح `src/components/dashboard/AiOrdersManager.jsx`:
  - تحويل `processedAiOrders` إلى `Set` مع حدّ أعلى 500 معرف وإزالة الأقدم.
  - إغلاق `isProcessingRef` داخل `finally` فقط مع ضمان عدم التهام الاستثناءات.
  - toast واحد بـ id ثابت + refetch واحد فقط بعد النجاح.
- لا تغيير على تجربة بقية الموظفين (أحمد وغيره).

تحقّق نهائي بعد التنفيذ

- فاتورة **3612243**: ربح الموظف يُعرض **84,000**، صافي المالكين **+12,000**، بطاقتا الزيادة (+20,000) والخصم (−20,000) تبقيان كما هي.
- فاتورة **3623484**: "المفروض قبل الخصم" يُعرض **980,000**، خصم الوسيط 30,000 منفصل.
- التحصيل **149922672**: تأكيد "استلمت" يعمل من أول ضغطة ويُسجَّل 25,000 في قاصة المالك أحمد بدون خطأ.
- المدير العام يوافق على طلب ذكي من المرة الأولى مثل بقية الموظفين دون تأخر أو خطأ.

الملفات المتأثرة (تقني)

- `src/lib/invoiceProfitsCalc.js`
- `src/components/orders/InvoiceProfitsTab.jsx` + `RevenueSplitCard` المرتبطة
- ترحيل DB: استبدال `create_off_channel_cash_movement_on_settle` + إعادة احتساب profits للفاتورتين
- `src/contexts/SuperProvider.jsx`
- `src/components/dashboard/AiOrdersManager.jsx`

خارج النطاق
- لا تغيير على منطق الإرجاع/الجزئي.
- لا تغيير على دوال الأرباح المخزّنة في DB (إعادة احتساب فقط).
- لا تغيير على توزيع delta لموظف بلا قاعدة (يبقى نسبياً).
