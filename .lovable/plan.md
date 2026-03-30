

# خطة إصلاح شاملة: عزل البيانات، الإحصائيات، التحاسب، الحذف التلقائي

## المشاكل المكتشفة والحلول

### 1. عبدالله لا يزال يظهر عند سارة (طلبات التحاسب + الفواتير)

**السبب الجذري:** في `ProfitsContext.jsx` سطر 534-538، جلب `settlementRequests` يستعلم **كل** إشعارات `settlement_request` بدون فلترة حسب المشرف:
```js
const { data: notificationsData } = await supabase
  .from('notifications')
  .select('*')
  .in('type', ['settlement_request', 'settlement_invoice'])
```
لا يوجد `.eq('user_id', ...)` أو `.in('employee_id', supervisedIds)` — لذا سارة ترى طلبات تحاسب عبدالله رغم أنه ليس تحت إشرافها.

كذلك الـ realtime subscription (سطر 571) يستمع لكل `settlement_request` INSERT بدون فلترة.

**الإصلاح:**
- في `fetchProfitsData`: إذا لم يكن المستخدم admin، فلترة بـ `user_id` (الإشعار يُرسل للمشرف)
- أو جلب `supervisedEmployeeIds` وفلترة `req.data.employee_id in supervisedIds`

### 2. إحصائيات الموظف (المنتجات الأكثر طلباً، المدن، العملاء) تظهر 0

**السبب الجذري:** في `useOrdersAnalytics.js` سطر 61-63:
```js
const visibleOrders = (canViewAllOrders && !forceUserDataOnly) ? orders : orders.filter(order => 
  order.created_by === userUUID
);
```
- المشكلة 1: `canViewAllOrders` من `usePermissions` — مدير القسم ليس لديه هذه الصلاحية → يفلتر بـ `created_by === userUUID`
- المشكلة 2: `userUUID` قد يكون `user_id` وليس `id` (من `getUserUUID`) — لا يطابق `created_by` الذي يستخدم `auth.uid()`
- المشكلة 3: الشرط `isOrderCompletedForAnalytics` (سطر 73-81) يتطلب للموظف أن الـ profit record يكون `settled` — إذا لم تتم التسوية لا يظهر شيء

**الإصلاح:**
- فحص `created_by` مقابل كلا `user.id` و `user.user_id`
- تغيير `isOrderCompletedForAnalytics` للموظف: الطلب المكتمل/المسلم مع `receipt_received` يكفي (لا حاجة لـ `settled`)

### 3. نقاط العملاء تُحسب لطلبات غير مكتملة

**السبب:** في `CustomersManagementPage.jsx` سطر 188-193:
```js
const eligibleOrders = useMemo(() => {
  return (orders || []).filter(
    (o) => ['completed', 'delivered'].includes(o.status) && o.receipt_received === true
  );
}, [orders]);
```
هذا صحيح — يفلتر فقط المكتملة/المسلمة مع إيصال. **لكن** النقاط في DB (`customer_phone_loyalty.total_points`) قد تكون مُحتسبة عند إنشاء الطلب وليس عند اكتماله. النقاط في الكارد تأتي من `cpl.total_points` مباشرة من الجدول.

**التحقق:** هل trigger `add_loyalty_points` يُضيف نقاطاً عند إنشاء الطلب أم عند التسليم؟ الإحصائيات في الكارد (`ordersCount`, `spentNoDelivery`) محسوبة محلياً من `eligibleOrdersByUser` (مفلترة) — لكن `total_points` من DB قد تكون مختلفة.

**الإصلاح:** عرض النقاط المحسوبة محلياً (`ordersCount * 250`) بدل `total_points` من DB، أو التأكد أن trigger النقاط يعمل فقط عند `receipt_received = true`.

### 4. تحليل أرباح المنتجات (263 طلب مسلّم) — يعرض بيانات النظام كله

**السبب:** في Dashboard (سطر 882):
```js
<TopProductsDialog employeeId={canViewAllData ? null : (user?.id || user?.user_id)} />
```
`TopProductsDialog` يستقبل `employeeId` **لكن لا يستخدمه** (سطر 8-10 في الملف):
```js
const TopProductsDialog = ({ open, onOpenChange, employeeId = null }) => {
  const { analytics, loading } = useOrdersAnalytics();
```
يستدعي `useOrdersAnalytics()` بدون `forceUserDataOnly` → يعرض كل الطلبات إذا كان المستخدم يملك `canViewAllOrders`.

**الإصلاح:** 
- تمرير `forceUserDataOnly = !canViewAllData` لـ `useOrdersAnalytics`
- أو تمرير `employeeId` واستخدامه لفلترة الطلبات

### 5. ملخص الأرباح والخسائر — إضافة المشتريات

**الوضع الحالي:** في `EmployeeFinancialCenterPage.jsx` سطر 258:
```js
const netProfit = grossProfit - generalExpenses - employeeSettledDues;
```
المشتريات (`totalPurchases`) محسوبة (سطر 254) لكن **لا تُخصم** من صافي الربح.

**الإصلاح:** إضافة toggle "تضمين المشتريات" وعند تفعيله:
```js
const netProfit = grossProfit - generalExpenses - employeeSettledDues - (includePurchases ? totalPurchases : 0);
```
وإضافة صف `المشتريات` في تقرير الأرباح والخسائر.

### 6. الحذف التلقائي الخاطئ — السبب الحقيقي

**التحليل الدقيق:** بعد فحص الكود وجدت **3 مسارات** تحذف طلبات:

**المسار 1 (الأخطر) — `syncOrderByTracking` سطر 4115-4128:**
```js
if (!waseetOrder) {
  const { data: localOrder } = await scopeOrdersQuery(...)
  if (!localErr && localOrder && canAutoDeleteOrder(localOrder, user)) {
    return await performAutoDelete(localOrder);
  }
}
```
هذا يحذف **بفحص واحد فقط** بدون 3 محاولات وبدون `checkOrderWithAllTokens`. إذا فشل API مرة واحدة (timeout, rate limit, network error) → يُحذف الطلب فوراً.

**المسار 2 — `syncVisibleOrdersBatch` سطر 2860-2928:**
يفحص 3 مرات بتوكن محدد. لكن إذا لم يجد توكن صالح → لا يحذف (محمي). المشكلة: إذا وجد توكن لكن API أعاد خطأ → يعتبره "غير موجود".

**المسار 3 — `syncOrderByQRGeneric` سطر 3767-3775:**
يستخدم `checkOrderWithAllTokens` مرتين (الأكثر أماناً) لكن يحذف بعدها بدون cooldown.

**السبب المؤكد:** المسار 1 (`syncOrderByTracking`) هو الأخطر — فحص واحد فقط + حذف فوري. أي `timeout` أو `rate limit` في API → الطلب يُحذف.

---

## التنفيذ

### المرحلة 1: إصلاح طلبات التحاسب — `ProfitsContext.jsx`
- فلترة `settlementRequests` في `fetchProfitsData`:
  - إذا admin: كل الطلبات
  - إذا غير admin: فقط الإشعارات التي `user_id = currentUser.id` (الإشعار مُوجه للمشرف)
- تعديل realtime subscription لفلترة `user_id`

### المرحلة 2: إصلاح إحصائيات الموظف — `useOrdersAnalytics.js`
- فحص `created_by` مقابل `user.id` و `user.user_id`
- تغيير `isOrderCompletedForAnalytics` للموظف: `receipt_received` + `delivered/completed` يكفي (بدون شرط `settled`)
- تمرير `forceUserDataOnly` عند استدعاء من Dialogs

### المرحلة 3: إصلاح Dialogs الثلاثة
**`TopProductsDialog.jsx`** + **`TopProvincesDialog.jsx` (dashboard)** + **`TopCustomersDialog.jsx`:**
- تمرير `useOrdersAnalytics(true)` (forceUserDataOnly) عندما يكون `employeeId` موجوداً

### المرحلة 4: إضافة المشتريات لملخص الأرباح — `EmployeeFinancialCenterPage.jsx`
- إضافة state `includePurchases` مع toggle
- تعديل `netProfit` ليخصم المشتريات عند التفعيل
- إضافة صف `المشتريات` في تقرير الأرباح والخسائر

### المرحلة 5: إصلاح عرض الموظفين — `EmployeeFollowUpPage.jsx`
- إضافة guard أقوى: إذا `isDepartmentManager && !supervisedEmployeeIds.length && !loadingSupervisedIds` → إرجاع صفر لكل الإحصائيات

### المرحلة 6: إيقاف الحذف في `syncOrderByTracking`
- في سطر 4126: إزالة الحذف الفوري — فقط تسجيل warning
- هذا هو المسار الأخطر ويجب تعطيله حتى يتم إصلاحه لاحقاً

---

## الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `ProfitsContext.jsx` | فلترة settlementRequests حسب المشرف |
| `useOrdersAnalytics.js` | إصلاح فلترة المستخدم + isCompleted |
| `TopProductsDialog.jsx` | تمرير forceUserDataOnly |
| `TopProvincesDialog.jsx` (dashboard) | تمرير forceUserDataOnly |
| `TopCustomersDialog.jsx` | تمرير forceUserDataOnly |
| `EmployeeFinancialCenterPage.jsx` | إضافة المشتريات + toggle |
| `EmployeeFollowUpPage.jsx` | guard إضافي |
| `AlWaseetContext.jsx` | تعطيل الحذف في syncOrderByTracking |

## بخصوص تجديد التوكن والمزامنة التلقائية
- تجديد التوكن يعمل عبر Edge Function `refresh-delivery-partner-tokens` كل 6 ساعات (cron) — يعمل حتى لو الموقع مغلق ✅
- المزامنة التلقائية: `smart-invoice-sync` تعمل كـ cron أيضاً — مستقلة عن المتصفح ✅

