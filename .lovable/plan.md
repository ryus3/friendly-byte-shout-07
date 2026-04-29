السبب الحقيقي الذي وجدته:

1. خطأ مدن الحالي ليس من الكاش ولا من ترجمة المنطقة.
   - الطلب الأخير: بغداد / حي الجامعه نفق الشرطة.
   - Resolver أعطى نتيجة صحيحة لمدن:
     - city_external_id = 1
     - region_external_id = 546
   - كاش مدن موجود وصحيح تقريباً: 5,755 منطقة نشطة.
   - خطأ مدن في اللوج هو: "ليس لديك صلاحية الوصول" عند create-order.

2. السبب المرجّح والحقيقي من توثيق مدن: مدن تريد التوكن في رابط الطلب:
   ```text
   /create-order?token=loginToken
   ```
   بينما كود modon-proxy يرسله حالياً في Header فقط:
   ```text
   Authorization: Bearer token
   ```
   بعض endpoints مثل جلب الطلبات/الفواتير كانت تمرر token في query، لذلك كانت تعمل، لكن create-order/edit-order/delete_orders لا تمرره في query. هذا يفسر لماذا "كان يعمل" ثم توقف بعد تغييرات البروكسي/المسار، ولماذا الوسيط يعمل ومدن لا.

3. بوت تليغرام حالياً يعتمد على master id + أسماء المناطق، وهذا صحيح كمبدأ، لكن يجب جعله عالمياً أكثر:
   - لا نخزن في الطلب الذكي "external_id خاص بشركة واحدة" كحقيقة نهائية.
   - نخزن city_id/region_id كمعرفات داخلية موحّدة إن أمكن.
   - عند الموافقة، نترجم إلى external_id للشركة المختارة فقط.
   - إذا لم توجد ترجمة مؤكدة، نوقف الموافقة برسالة واضحة ولا نخمن.

الخطة التنفيذية بعد الموافقة:

1. إصلاح modon-proxy حسب توثيق مدن
   - إضافة token دائماً في query string لكل endpoints مدن التي تتطلبه، خصوصاً:
     - create-order
     - edit-order
     - delete_orders
     - merchant-orders
     - statuses
     - invoices
   - إبقاء Authorization header فقط كاحتياط، لكن المصدر الرسمي سيكون query token.
   - منع direct fallback لمدن عند فشل static proxy إذا كان الهدف الحفاظ على IP ثابت/وايتلست، أو جعله مشروطاً وآمناً. حالياً البروكسي يقع إلى direct عند 5xx وهذا قد يسبب مشاكل IP مستقبلاً.
   - تحسين رسالة الخطأ: إذا جاء errNum 21 + "ليس لديك صلاحية الوصول" على create-order، الرسالة تكون "صلاحية/توكن/طريقة تمرير token" وليس "منطقة غير صالحة".

2. إصلاح createModonOrder و edit/delete في الواجهة
   - تمرير token كـ queryParams أيضاً، وليس فقط في body/headers.
   - معالجة رد مدن لأن data في التوثيق Array أحياناً، وليس object فقط:
     - استخراج qr_id/id من data[0] أو data.
   - عدم اتهام الكاش إذا كانت المنطقة مترجمة بنجاح وكان الخطأ صلاحيات.

3. تثبيت Resolver العالمي للمدن والمناطق
   - تحديث resolve_partner_location ليقبل هذه الحالات بترتيب صارم:
     1. master city_id/region_id داخلي.
     2. external_id للشركة المختارة.
     3. external_id لشركة أخرى ثم bridge عبر master id.
     4. الاسم داخل نفس المدينة فقط.
   - إرجاع سبب دقيق عند الفشل:
     - city_not_mapped
     - region_not_mapped
     - ambiguous_region
     - partner_token_error
   - عدم استخدام بغداد/أول منطقة كـ fallback نهائياً.

4. جعل بوت التليغرام مهيأ لشركات مستقبلية
   - تحميل المدن/المناطق من الجداول الموحدة مع mappings، وليس الاعتماد على alwaseet_id كأنه عام.
   - عند اختيار المستخدم لمنطقة من "هل تقصد؟" يتم تمرير master region_id إن توفر، وليس externalId لشركة معينة.
   - إضافة metadata داخل ai_orders يوضح:
     - source_partner_hint إن وجد
     - resolved master ids
     - resolved names
   - الموافقة هي التي تحدد الشريك النهائي وترجمته.

5. إصلاح تعيين الشركة والحساب الافتراضي
   - عند اختيار شركة كافتراضية من نافذة شركات التوصيل:
     - تحديث profiles.selected_delivery_partner
     - تحديث profiles.default_ai_order_destination
     - تحديث profiles.selected_delivery_account للحساب الافتراضي لنفس الشركة
     - تحديث delivery_partner_tokens.is_default داخل نفس الشريك فقط
     - تحديث active_delivery_partner و delivery_default_accounts محلياً
   - منع حالة: الشركة الافتراضية مدن لكن الحساب المختار من الوسيط، أو العكس.

6. تأكيد مبدأ المزامنة العالمي
   - المبدأ الصحيح عالمياً هو:
     ```text
     كل طلب محلي يحتوي:
       delivery_partner
       delivery_account_used
       delivery_partner_order_id / qr_id

     المزامنة تعمل لكل token على حدة:
       token + partner + account

     المطابقة تقبل فقط:
       نفس partner
       ونفس account إن كان محفوظاً
       ونفس id/qr/tracking
     ```
   - سأراجع sync-order-updates وأضيف/أشدد شرط الحساب حتى لا يحصل خلط بين حسابين لنفس الشركة.
   - لا حذف تلقائي بسبب خطأ مزامنة أو عدم ظهور الطلب في token آخر. الحذف/الاعتبار محذوف يكون فقط بعد تحقق صريح من نفس partner ونفس account ونفس token أو endpoint حذف/حالة مؤكدة.

7. التحقق بعد التنفيذ
   - نشر modon-proxy المحدث.
   - اختبار modon-proxy مباشرة باستدعاء create-order بشكل آمن إن أمكن بدون إنشاء طلب حقيقي عشوائي، أو على الأقل اختبار endpoint غير منشئ للتأكد من طريقة token query.
   - فحص logs بعد محاولة الموافقة.
   - التأكد من أن الطلب الذكي لا يُحذف إلا بعد نجاح إنشاء الطلب الخارجي والمحلي.

النتيجة المتوقعة:
- موافقة مدن سترسل الطلب باستخدام توكن مدن الصحيح وبصيغة مدن الرسمية.
- المنطقة "حي الجامعه نفق الشرطة" لن تكون سبب رفض لأنها مترجمة فعلاً إلى ID مدن الصحيح.
- الكاش يبقى تحديثاً لا تخريباً: upsert حسب (partner, external_id)، ولا نخلط external_id بين الشركات.
- النظام يصبح قابلاً لإضافة شركات توصيل جديدة عبر mappings بدون تعديل منطق الموافقة الأساسي.