# خطة شاملة - التأكد والإصلاحات النهائية

## 1) المزامنة التلقائية والكرون (تأكيد)

الكرون يعمل فعلياً:
- `smart-invoice-sync-morning` — 06:00 يومياً
- `smart-invoice-sync-evening` — 20:45 يومياً
- `sync-order-updates-scheduled` — كل دقيقة (ضمن 08:00–20:00 بغداد)
- `cleanup-background-sync-logs` — يومياً 02:00

**سأضيف** فحص تحقق نهائي:
- التأكد أن كرون `smart-invoice-sync` يستخدم `mode: 'smart'` بدون `force_refresh` (نفس منطق زر التحديث الجديد).
- التأكد أن `link_invoice_orders_to_orders` تُستدعى بعد كل upsert (بالفعل موجودة في الإيدج فانكشن بعد batchUpsert).
- التحقق من أن الكرون يعمل عند إغلاق الموقع (pg_cron مستقل عن الواجهة) — مؤكد.

## 2) توجيه الإشعار لمالك المنتج (أحمد)

**الفحص**: حالياً إشعار "وصول فاتورة/طلب مكتمل" قد يذهب لمنشئ الطلب أو المدير.

**الإصلاح**: تعديل دالة الإشعارات في `smart-invoice-sync` و triggers قاعدة البيانات لتقرأ `owner_user_id` من `products` المرتبطة بالطلب، وتُرسل الإشعار لكل مالك منتج فعلي (أحمد لمنتجاته)، وليس للمدير العام. مع fallback للمدير فقط إذا لم يوجد owner.

## 3) الإيرادات حسب سعر شركة التوصيل (خصم/زيادة)

**نعم كلامك صحيح**. السعر الفعلي = `delivery_partner_invoice_amount` (أو `price` من API الفاتورة) وليس `final_amount` المحلي.

ملاحظة الحركة `+-5000`: الطلب 142143592 لديه `final_amount=0` و `total_amount=-5000` (سعر شركة التوصيل كان 0 لكن أجور التوصيل 5000 خُصمت). الحركة `in` بقيمة `-5000` تعني **خصم 5000 د.ع من الكاش بسبب الفرق السلبي** (الزبون استلم جزء فقط أو إرجاع وأجور توصيل أُخذت).

**الإصلاح**:
- توحيد منطق الإيراد ليأخذ السعر من فاتورة الوسيط دائماً (`delivery_partner_invoice_amount` أو `price` من `delivery_invoice_orders.raw`).
- عرض الحركات السالبة بلون أحمر واضح (بدل +-) مع وصف: "تسوية فرق سعر التوصيل" بدل "إيراد".
- منع ظهور `+-` بتنسيق الأرقام: عرض `-5,000 د.ع` للسالب و `+5,000 د.ع` للموجب.

## 4) نافذة الفاتورة - منع التمرير الأفقي

في `InvoiceDetailsDialog` (نافذة "عرض التفاصيل"): إضافة `overflow-x-hidden` على المحتوى، و `max-w-full` على البطاقات، وتقليل padding على الموبايل، ولفّ النصوص الطويلة (`break-words`, `truncate` للأرقام الطويلة مثل tracking_number).

## 5) إعادة تصميم الزر العائم (زجاجي احترافي)

تصميم جديد لـ `FloatingScrollButton.jsx`:
- **Glassmorphism حقيقي**: `backdrop-blur-2xl`, طبقة gradient شفافة (`from-primary/30 via-purple-500/20 to-blue-500/30`).
- **حلقة متوهجة** خارجية (`ring-2 ring-white/40 ring-offset-2`) + glow ناعم (`shadow-[0_8px_32px_rgba(99,102,241,0.4)]`).
- **أيقونة متحركة** داخل دائرة gradient، مع pulse خفيف وتدرّج لوني عند الـ hover.
- **شكل**: دائري كامل `rounded-full` بحجم `w-12 h-12` (أصغر وأناقة)، مع طبقة highlight علوية لإيهام الزجاج.
- يحتفظ بالـ drag والـ scroll up/down.

## التغييرات التقنية

| ملف | تغيير |
|---|---|
| `supabase/functions/smart-invoice-sync/index.ts` | توجيه الإشعار حسب `products.owner_user_id`؛ استخدام سعر فاتورة الوسيط |
| migration جديد | تحديث trigger الإشعارات + دالة `notify_invoice_received` لاستخدام owner_user_id |
| `src/components/orders/InvoiceDetailsDialog.jsx` (أو ما يعادله) | `overflow-x-hidden`, `break-words`, تنسيق أرقام |
| `src/components/cash/CashMovementsList.jsx` | تنسيق `-5,000` بدل `+-5,000`، وصف أوضح للتسويات السالبة |
| `src/components/ui/FloatingScrollButton.jsx` | تصميم زجاجي احترافي |

## ما لن أغيّره
- منطق الكرون الحالي (يعمل).
- منطق `link_invoice_orders_to_orders` (مُصلح في الجولة السابقة).
- منطق reserved stock / completion gate.
