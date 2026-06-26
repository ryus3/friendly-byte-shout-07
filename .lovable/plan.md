
## الخطة الكاملة

### 1) كرت "تحصيلات بانتظار التأكيد" في الداشبورد
- إنشاء `PendingCollectionsCard.jsx` بنفس تصميم باقي كروت `UnifiedDashboard` (نفس الـ gradient، نفس الأيقونة الأنيقة `Wallet`/`HandCoins`، نفس Glow وShadow وHover).
- موضعه: مباشرة **أسفل كرت "متابعة الموظفين"**.
- يظهر للمدير وللمالك (يفلتر النتائج حسب الصلاحيات تلقائياً عبر RLS).
- يحتوي على **Badge أحمر بعدد التحصيلات المنتظرة** (نفس نمط Badge الإشعارات).
- العنوان: "تحصيلات بانتظار التأكيد".
- النقر يفتح صفحة `/off-channel-inbox` الاحترافية.

### 2) نافذة تأكيد إجبارية للمالك (Both: كرت + Modal)
- بمجرد دخول المالك للتطبيق وجود تحصيلات معلقة → **Modal إجباري** (لا يمكن إغلاقه بـ Escape أو خارج النقر) يعرض كل التحصيلات.
- نفس فلسفة نافذة التسليم الجزئي: إجبارية لكن مع زر "تأجيل لاحقاً" (snooze ساعة) ليس "إلغاء".
- كل سطر يعرض: رقم الطلب + اسم الزبون + المبلغ + زرّان كبيران: **"استلمت المبلغ ✅"** و **"لم يصلني ❌"**.
- نفس النافذة متاحة من الكرت في الداشبورد (غير إجبارية حينها).

### 3) صفحة `OffChannelOwnerInbox.jsx` احترافية
- إعادة تصميم بطابع عالمي: Cards بـ glass-morphism + تدرّجات + Skeleton loaders + Empty state أنيق + Filters (الكل/معلق/مؤكد/مرفوض).
- للمدير: يرى كل التحصيلات + قدرة التأكيد نيابة عن المالك بزر "تأكيد كمدير".
- للمالك: يرى تحصيلاته فقط + زرّي تأكيد/رفض.
- Real-time updates عند تغيير الحالة.

### 4) إصلاح وصول الإشعار للمالك الفعلي
- ميغريشن: تعديل `notify_owner_off_channel_pending` ليُرجع `owner_user_id` من `order_items.products.owner_user_id` (وليس منشئ الفاتورة).
- Backfill: إعادة تعيين `owner_user_id` للسجلات الموجودة (خاصة طلب 149922672) وإرسال الإشعارات للملاك الصحيحين.

### 5) إصلاح الموافقة على الطلبات الذكية (مشكلة المدير العام + "نايك نيلي")

**التشخيص الفعلي من الكود (`SuperProvider.jsx` سطر 2107-2155):**
- المطابقة الحالية تستخدم `lowercase(p.name) === name` ثم `.includes(name)`. عندما يرسل AI اسماً مركباً مثل `"نايك نيلي"`، لا يطابق منتجاً اسمه `"نايك"` فيعود `notMatched` ويتم الإرجاع `success:false` بصمت داخل حلقة الـ bulk.
- في حساب المدير العام تحديداً: عند الموافقة، يظهر toast "جاري المعالجة" ثم يختفي بدون toast نهائي لأن الـ loop ينتهي مع `successIds=[]` و`failedResults` لا يصل للمستخدم بسبب timing الـ toasts المتتالية يطغى بعضها على بعض.

**الإصلاحات:**
- **مطابقة ذكية موحّدة** (function `smartMatchProduct`):
  - تقسيم الاسم المركب إلى أجزاء (split على المسافات).
  - استخراج الجزء الأول كاسم منتج محتمل والباقي كلون/مقاس.
  - مطابقة المنتج بأطول prefix مشترك، ثم البحث في variants عن أي جزء يطابق `color` أو `size`.
  - مثال: `"نايك نيلي"` → منتج=`"نايك"` + لون=`"نيلي"` ✅.
- **توحيد عرض الأخطاء**: استبدال toasts المتعاقبة بـ **toast واحد محدّث** (id ثابت) يعرض التقدم، وtoast نهائي مفصّل بأسباب الفشل لكل طلب فاشل.
- **منع النقر المزدوج**: إضافة `useRef(isProcessingRef)` يمنع `handleBulkAction` من التشغيل المتوازي.
- **clear state عند الانتهاء**: التأكد من تنظيف `selectedOrders` وإعادة `isProcessingRef=false` في `finally` بدلاً من نهاية try.
- **تشخيص واضح للمدير**: لو الفشل سببه أن منشئ الطلب الأصلي ليس لديه حساب توصيل نشط، يظهر toast صريح: "الموظف X ليس لديه حساب نشط في الوسيط".

### 6) إصلاح "950 vs 925" في الفاتورة
- في `InvoiceProfitsTab.jsx`: استخدام `invoiceAmount` كمصدر وحيد لسطر "من شركة التوصيل" (= 950,000). إزالة أي حساب يطرح/يجمع شيئاً منه في هذا السطر.

---

### الملفات المتأثرة
```text
src/components/dashboard/PendingCollectionsCard.jsx          (جديد)
src/components/dashboard/UnifiedDashboard.jsx                (إضافة الكرت)
src/components/accounting/OffChannelMandatoryDialog.jsx      (جديد - النافذة الإجبارية)
src/components/Layout.jsx                                    (Mount الـ Dialog عالمياً)
src/components/accounting/OffChannelOwnerInbox.jsx           (إعادة تصميم)
src/components/orders/InvoiceProfitsTab.jsx                  (إصلاح 950)
src/contexts/SuperProvider.jsx                               (smartMatchProduct)
src/components/dashboard/AiOrdersManager.jsx                 (toast واحد + isProcessingRef + finally)
supabase/migrations/<new>.sql                                (owner_user_id من المنتج + backfill)
```

### تفاصيل تقنية للمطوّر
- النافذة الإجبارية تُركّب في `Layout.jsx` بشرط `rows.length > 0 && !snoozedUntil`.
- `snoozedUntil` يُحفظ في `localStorage` لمدة ساعة فقط ثم تظهر مجدداً.
- `smartMatchProduct` يُستخرج كـ utility في `src/lib/aiOrderMatcher.js` لإعادة الاستخدام.
- Badge يستخدم `useOffChannelCollections` الحالي (يعيد `rows.length`).
