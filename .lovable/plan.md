# خطة الإصلاحات المحدثة

## 1) الحذف التلقائي بالمزامنة الاعتيادية (الواجهة) — لا يعمل

**التشخيص:** الحذف يعمل ممتازاً في الخلفية (edge `sync-order-updates` يعتمد `partner_missed_count>=3` + عمر≥3د + حساب موجود فعلياً). لكن المزامنة الاعتيادية في `AlWaseetContext.jsx` (سطر 1518-1582) تستخدم منطقاً مختلفاً: 3 محاولات `getOrderByQR` فورية بدون `partner_missed_count`، فإذا فشلت أي محاولة (rate-limit/WAF) لا يحدث الحذف.

**الحل:** نوحّد منطق الواجهة مع الـ edge function:
- زيادة `partner_missed_count` بدلاً من الحذف الفوري.
- حذف فقط عند توافر **كل** الشروط معاً:
  - `partner_missed_count >= 3`
  - عمر الطلب `>= 3 دقائق`
  - الحساب (`delivery_account_used`) جُلب فعلاً في هذه الدورة
  - `delivery_status IN ('1','pending')`
  - `receipt_received = false`
  - `delivery_partner_invoice_id IS NULL`
- عند العثور: إعادة `partner_missed_count = 0`.
- التوكن المُستخدم = توكن الحساب الأصلي للطلب.

**ملف:** `src/contexts/AlWaseetContext.jsx`.

---

## 2) طلبات الاستبدال/الإرجاع — قاعدة جديدة صارمة

**القاعدة (حسب توضيحك):**
- **طلب الاستبدال = طلب الاستبدال** (ليس "تسليم جزئي" أبداً).
- **طلب الإرجاع = طلب الإرجاع**.
- **السعر يساوي تماماً سعر شركة التوصيل** (قد يكون 5000 = رسوم توصيل فقط، أو 0 = النظام يدفع التوصيل، أو فرق سعر منتجين). **لا نفترض أبداً سعر المنتج**.
- **لا تفتح نافذة "التسليم الجزئي"** لطلبات الاستبدال/الإرجاع.

**التشخيص الحالي:**
- AlWaseet يرسل لطلب الاستبدال 144336931 سعراً = 25,000 + فلاغ exchange/replacement.
- نظامنا الآن يصنّف أي طلب فيه عنصر راجع + عنصر مسلّم كـ "تسليم جزئي" → يفتح النافذة + يحسب `final_amount` خاطئاً.

**الحل:**
1. **اكتشاف نوع الطلب من AlWaseet** في `src/contexts/AlWaseetContext.jsx` (داخل `syncVisibleBatch`):
   - إذا الـ API يُرجع `replacement: true` أو `order_type` يدل على استبدال → اضبط `orders.order_type = 'exchange'`.
   - إذا فقط عنصر راجع بدون مسلَّم → `order_type = 'return'`.
   - وإلا فقط (مسلَّم جزئي حقيقي) → `order_type = 'partial_delivery'`.
2. **السعر دائماً = `price` من الوسيط** بلا حساب يدوي:
   - `final_amount = Number(waseetResponse.price)` (قد يكون 0/5000/25000).
   - `delivery_fee = Number(waseetResponse.delivery_price)`.
   - لا تطرح/تجمع تكلفة منتجات. لا تفترض أي شيء.
3. **عدم فتح نافذة التسليم الجزئي** إلا إذا `order_type = 'partial_delivery'` فعلاً.
4. **عرض UI:**
   - بطاقة الطلب (`OrderCard`): شارة "طلب استبدال" بدل "تسليم جزئي" + تمييز العنصر الخارج (راجع) والداخل (مسلَّم) بألوان مختلفة.
   - نافذة التفاصيل (`OrderDetailsModal`): شارة "استبدال" / "إرجاع" / "تسليم جزئي" بحسب `order_type`.
   - المبلغ المعروض = `orders.final_amount` (المحدّث من الوسيط).

**ملفات:**
- `src/contexts/AlWaseetContext.jsx` — تصنيف order_type + ضبط final_amount.
- `src/components/orders/OrderCard.jsx` (أو ما يكافئه) — شارة استبدال.
- `src/components/orders/OrderDetailsModal.jsx` — عرض الاستبدال.

---

## 3) نافذة التسليم الجزئي — إضافة رقم هاتف الزبون

في النافذة التي يختار فيها المستخدم العنصر المباع: عرض رقم هاتف الزبون (وارقم الطلب) في الـ Header.

**ملف:** `src/components/orders/PartialDeliveryDialog.jsx` (أو ما يطابقه — سأبحث عنه عند التنفيذ).

---

## 4) ربط الطلبات (تسليم جزئي/استبدال) بالفاتورة — تأخير

**السبب:** دالة `link_invoice_orders_to_orders` تطابق على `tracking_number` فقط. الطلبات الفرعية للاستبدال أحياناً تحمل tracking مختلف.

**الحل:**
- توسيع المطابقة لتشمل `tracking_number` + `delivery_partner_order_id` + `qr_id` (OR).
- self-healing فوري عند فتح الفاتورة: إذا `linked < expected` نستدعي الدالة فوراً.
- migration: فهرس على `orders(tracking_number, delivery_partner_order_id, qr_id)`.

---

## 5) شارة "محفوظ 81/77" — Tooltip توضيحي

في `AlWaseetInvoiceDetailsDialog.jsx` على بطاقة "محفوظ":
> "81 = 77 طلب أصلي + 4 طلبات استبدال/إرجاع مرتبطة بنفس الفاتورة"

---

## 6) ✅ تأكيد: أرباح/مستحقات الفاتورة محسوبة بالسعر الأخير

راجعت `InvoiceProfitsTab.jsx` (سطر 188-194):
```
revenueFromOrders = SUM(orders.final_amount - orders.delivery_fee)
totalRevenue = revenueFromOrders  // ← السعر النهائي للطلب
```
الحساب صحيح. **بعد إصلاح #2** سيُحدَّث `final_amount` ليطابق سعر شركة التوصيل دائماً، وكل الأرقام ستصير صحيحة تلقائياً.

**إضافة وقائية في الـ edge function `sync-order-updates`:** عند كل مزامنة، إذا `waseet.price != order.final_amount` نحدّث `final_amount` (والـ trigger الموجود سيعيد حساب الربح).

---

## 7) إحصائيات "الأكثر طلباً" — فلترة الفترة لا تعمل

في `TopProductsDialog/TopProvincesDialog/TopCustomersDialog`: `selectedPeriod` معرَّف لكن **غير مربوط بـ `setDateRange`** في `useOrdersAnalytics` → كل الفلاتر تعرض "كل الفترات".

**الحل:** ربط `selectedPeriod` بـ `setDateRange` في الـ 3 dialogs.

شرط الإكمال (`receipt_received = true` + status صحيح) سليم بالفعل، وفلترة الموظف (`forceUserDataOnly` + `canViewAllOrders`) سليمة.

---

## الملفات المتأثرة

- `src/contexts/AlWaseetContext.jsx`
- `src/components/orders/OrderCard.jsx` + `OrderDetailsModal.jsx` + `PartialDeliveryDialog.jsx`
- `src/components/orders/AlWaseetInvoiceDetailsDialog.jsx`
- `src/components/dashboard/TopProductsDialog.jsx` + `TopProvincesDialog.jsx` + `TopCustomersDialog.jsx`
- `src/hooks/useOrdersAnalytics.js` (لو لزم)
- `supabase/functions/sync-order-updates/index.ts`
- Migration: فهرس على `orders` + تحديث `link_invoice_orders_to_orders`.

---

## خارج النطاق

- ❌ بغداد/المحطات (مؤجل للنقاش).
- ❌ Meta/Instagram API.
- ❌ تفعيل المتجر (نقاش لاحق).

هل أبدأ التنفيذ؟