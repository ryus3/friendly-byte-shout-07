
## 1. زر "تقرير أرباحي" (AlWaseetInvoicesTab.jsx)
- نفس حجم زر "تحديث" بالضبط (`size="sm"`, padding, ارتفاع موحد)
- تصميم متناسق: gradient أنيق صغير، أيقونة + نص قصير "تقريري"
- إزالة التوهج الزائد، خط واحد بدون التفاف

## 2. ثورة تصميمية لنافذة "تقرير أرباحي" (InvoicesProfitReportDialog.jsx)
- Hero header بتدرج أنيق + أيقونة دائرية متوهجة (دون مبالغة)
- **تبويبات قابلة للسحب يميناً ويساراً** (swipe gestures) بـ`framer-motion` (drag) — تبويبات: الملخص / الفواتير / المنتجات / الموظفون
- **فلتر سريع**: أزرار (اليوم/الأسبوع/الشهر/السنة/كل الفترات) + اختيار مخصص (DateRangePicker الحالي)
- بطاقات إحصائيات بتدرجات زجاجية (glassmorphism) مع animated counters
- قائمة فواتير بـcards محسّنة + سهم اختيار واضح + شارات partner/account ملوّنة
- شبكة منتجات مرتبة + شارة "الأعلى ربحاً"

## 3. إصلاح الإحصائيات = 0 (السبب الجذري)
المشكلة: `fetchInvoiceProfitsData` يجلب `orders.id IN orderIds` لكن `orderIds` يُمرَّر من delivery_invoice_orders وهو فعلاً موجود. لكن النافذة الحالية لا تستدعي `computeInvoiceProfits` على الـorders المُسترجعة بشكل صحيح بعد فلترة الفواتير المحددة.
- التحقق: ربط الفواتير المختارة → جلب `delivery_invoice_orders.order_id` → جلب orders كاملة → تمرير صحيح للحاسبة
- إصلاح حالة الـloading قبل عرض الأصفار
- استخدام `useMemo` لإعادة الحساب فور تغيير التحديد/الفترة
- عرض loader فعلي بدل صفر مضلل

## 4. إشعارات تغيير حالة الطلب (notify_order_status_change)
- التحقق من أن الـDB trigger يضع `full_name` فعلاً (آخر migration). الفحص يدوياً عبر supabase
- في `NotificationsContext`/مكوّن عرض الإشعار: عرض اسم الموظف بين قوسين بلون accent متناسق (مثلاً `text-primary` أو `text-violet-400`) — ليس نشاز
- إضافة fallback في الـedge function `ai-order-notifications` لإدراج الاسم لو ناقص

## 5. التسليم الجزئي للموظف عبدالله (الطلب 144908817)
- المشكلة الجذرية: `OrderCard.jsx` يفتح PartialDeliveryDialog فقط للأدمن أو لـcondition محدودة — يجب أن يفتح **لكل من ينشئ/يرى الطلب** عند تحوّله لحالة جزئية وقبل أي إجراء completion
- إضافة فحص دوري (mount + realtime) لكل طلب delivery_status='partial' وبدون `partial_delivery_items` → فتح المودال تلقائياً وإجبارياً
- دعم اختيار **عدة منتجات + كميات** (الكود الحالي يدعمها — تأكيد + اختبار)
- منع `completed` حتى يتم حفظ الاختيار

## 6. إكمال الخطة (المتبقي من خطة سابقة)
- **#2 دقة المخزون**: trigger مراجعة `reserved_quantity` يومياً + دالة `audit_inventory_consistency()` تكشف الانحرافات
- **#3 متاجر الموظفين الاحترافية**:
  - subdomain لكل موظف (`{username}.ryusbrand.com`) عبر Vercel wildcard + جدول `storefront_domains`
  - دعم Custom domain مع تعليمات DNS
  - ميزات: Reels (رفع فيديو + إعجاب + إضافة سلة)، عروض/خصومات، فئات، تصاميم theme، صفحات About/Policy
  - فصل `pos.ryusbrand.com` (النظام) عن `shop.*` و `{user}.*` (المتاجر)

## التنفيذ التقني
- الملفات: `AlWaseetInvoicesTab.jsx`, `InvoicesProfitReportDialog.jsx`, `invoiceProfitsCalc.js`, `OrderCard.jsx`, `PartialDeliveryDialog.jsx`, `NotificationsContext.jsx`, edge `ai-order-notifications`
- DB: تحقق من `notify_order_status_change`, إضافة `audit_inventory_consistency`, جدول `storefront_domains`
- مكتبات موجودة: framer-motion ✅, date-fns ✅

```text
┌─ تقرير أرباحي (Hero) ────────────┐
│  [الملخص] [الفواتير] [المنتجات]   │ ← swipe
├──────────────────────────────────┤
│  [يوم|أسبوع|شهر|سنة|الكل|مخصص]    │
│  ╭───────╮ ╭───────╮ ╭───────╮   │
│  │إيراد  │ │تكلفة  │ │ربح    │   │
│  ╰───────╯ ╰───────╯ ╰───────╯   │
└──────────────────────────────────┘
```
