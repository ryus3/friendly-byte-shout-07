

# إصلاح 3 مشاكل: مستحقات عبدالله + المركز المالي + التجديد التلقائي للتوكن

## المشكلة 1: مستحقات عبدالله تظهر لسارة

**السبب**: سارة مديرة قسم (`department_manager`) لكن عبدالله **ليس تحت إشرافها** — مشرفه هو المدير العام فقط. مع ذلك، صفحة `ProfitsSummaryPage` تعرض `settlementInvoices` بدون فلترة حسب الإشراف.

في السطر 403-406 من `ProfitsSummaryPage.jsx`:
```javascript
const totalSettledDues = settlementInvoices?.filter(inv => {
    const invDate = parseISO(inv.settlement_date);
    return isValid(invDate) && invDate >= from && invDate <= to;
}).reduce((sum, inv) => sum + inv.total_amount, 0) || 0;
```
لا يوجد فلتر حسب `supervisedEmployeeIds` — سارة ترى كل فواتير التسوية.

**الإصلاح**: فلترة `settlementInvoices` حسب الإشراف لمديري الأقسام:
- إذا كان مدير قسم: يرى فواتير تسوية الموظفين تحت إشرافه فقط
- إذا كان مدير عام: يرى الكل

**الملف**: `src/pages/ProfitsSummaryPage.jsx`

---

## المشكلة 2: المركز المالي للموظف مختلف عن المدير

**الوضع الحالي**: صفحة `EmployeeFinancialCenterPage` مبسطة جداً — تعرض فقط 3 كروت + تقرير أرباح وخسائر + حركات القاصة.

**المطلوب**: نسخة حرفية من `AccountingPage` (المركز المالي للمدير) لكن مفلترة للموظف:

### العناصر المفقودة التي يجب إضافتها:
1. **رأس المال الكلي** — إمكانية تعيين رأس مال خاص بالموظف (حقل `initial_capital` في `cash_sources`)
2. **قيمة المخزون** — المنتجات المملوكة للموظف
3. **تحليل أرباح المنتجات** — ربط بصفحة تحليل مفلتر
4. **FinancialPerformanceCard** — بيانات الأداء المالي
5. **إغلاق الفترات المالية** — `PeriodClosingManager` مفلتر
6. **إمكانية تعديل رأس المال** — `EditCapitalDialog` + `CapitalDetailsDialog`
7. **إمكانية تصدير تقرير PDF** — `FinancialReportPDF`
8. **إمكانية إضافة مصاريف من قاصة الموظف** — ليس من القاصة الرئيسية
9. **عرض المنتجات الخاصة + المنتجات المسموح بها من النظام**

### التعديلات:

| الملف | التعديل |
|-------|---------|
| `src/pages/EmployeeFinancialCenterPage.jsx` | إعادة بناء كاملة لتطابق `AccountingPage` مع فلترة بـ `userId` |
| Migration SQL | إضافة `initial_capital NUMERIC DEFAULT 0` لجدول `cash_sources` لحفظ رأس مال كل قاصة |

---

## المشكلة 3: التجديد التلقائي للتوكن لا يعمل

**السبب المؤكد**: الـ cron job يعمل بمستخدم `supabase_read_only_user` الذي **ليس لديه صلاحية** استدعاء `net.http_post`:

```text
ERROR: permission denied for function http_post
username: supabase_read_only_user
```

هذا الخطأ يتكرر يومياً منذ أيام. التوكنات تُجدد فقط عند فتح الموقع يدوياً.

**الإصلاح**: إعادة إنشاء الـ cron job بمستخدم `postgres`:

```sql
-- حذف القديم
SELECT cron.unschedule('refresh-delivery-tokens-daily');

-- إنشاء جديد بمستخدم postgres + المفتاح الجديد
SELECT cron.schedule(
  'refresh-delivery-tokens-daily',
  '0 8 * * *',
  $$SELECT net.http_post(
    url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/refresh-delivery-partner-tokens',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA'
    ),
    body:='{}'::jsonb
  );$$
);

-- تعيين المستخدم الصحيح
UPDATE cron.job SET username = 'postgres' WHERE jobname = 'refresh-delivery-tokens-daily';
```

**ملف واحد**: Migration SQL

بالإضافة، نفس المشكلة موجودة في `smart-invoice-sync-morning` (jobid 17) و `smart-invoice-sync-evening` (jobid 18) — كلاهما بمستخدم `supabase_read_only_user`. سأصلحهم أيضاً.

---

## ملخص الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `src/pages/ProfitsSummaryPage.jsx` | فلترة فواتير التسوية حسب الإشراف |
| `src/pages/EmployeeFinancialCenterPage.jsx` | إعادة بناء كاملة لتطابق المركز المالي للمدير |
| Migration SQL | إصلاح cron jobs + إضافة `initial_capital` للقاصات |

## ترتيب التنفيذ
1. Migration لإصلاح الـ cron jobs (أولوية قصوى — التوكنات ستنتهي)
2. إصلاح فلترة فواتير التسوية لسارة
3. إعادة بناء المركز المالي للموظف

