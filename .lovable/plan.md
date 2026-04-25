الخلاصة من الفحص العميق:

1. خطأ الوسيط الحالي ليس IP whitelist.
   الطلب يمر عبر البروكسي ويعود أحياناً 200 ثم بعدها 400/errNum:21 بنفس التوكن. هذا يعني أن التوكن نفسه غير مقبول/انتهى عند الوسيط أو الحساب لا يملك صلاحية لبعض الطلبات، وليس مشكلة وصول IP.

2. السبب الأكبر لاستمرار الخطأ في الواجهة:
   - `alwaseet-proxy` في الكود يعالج errNum:21 ويعيد 200 منظّم، لكن اللقطة الحالية أظهرت أن الدالة المنشورة ما زالت ترجع 400 خام. إذن يلزم إعادة نشر/تثبيت نسخة البروكسي بعد تعديلها.
   - `delivery_partner_default_token` في localStorage يحفظ التوكن بدون `expires_at` ولا يتحقق من قاعدة البيانات عند الاستعادة، فيمكن أن يستعيد توكن قديم رغم وجود توكن أحدث.
   - عند errNum:21 لا يتم إبطال التوكن في قاعدة البيانات ولا حذف الكاش المحلي فوراً، لذلك نفس التوكن يستمر بالاستدعاءات.

3. تراكم التوكنات:
   حالياً لا توجد نسخ كثيرة ظاهرة لنفس الحساب في الجدول، لكن يوجد أكثر من حساب AlWaseet كل واحد default=true بسبب وجود unique index على `(user_id, partner_name)` فقط وليس على `(user_id, partner_name, account_username)` كمنطق عملي. كما أن التجديد يحدث بتحديث الصف غالباً، لكن لا توجد دالة مركزية واحدة تضمن: تعطيل القديم + حذف الكاش + منع default متعددة.

4. مدن:
   الكاش تحسن لكنه ليس كامل من ناحية الربط:
   - `cities_master`: 18 مدينة.
   - `regions_master`: 17314 منطقة إجمالاً.
   - mappings لمدن: 7077 منطقة فقط.
   - آخر sync لمدن سجل 2406 فقط بسبب أخطاء `ON CONFLICT DO UPDATE command cannot affect row a second time` في بعض المدن.
   السبب: دالة `update-modon-cache` تزيل التكرار حسب `region_id`، بينما الصحيح لشركات التوصيل هو الحفظ حسب `(delivery_partner, external_id)` لأن نفس اسم المنطقة أو نفس master region يمكن أن يكون له أكثر من external_id. لذلك تضيع مناطق كثيرة أو تفشل upsert.

5. الواجهة ما زالت تستدعي MODON مباشرة في `QuickOrderContent.jsx` للمدن والمناطق والأحجام بدلاً من الكاش، وهذا يخالف الهدف ويزيد البطء والاستدعاءات.

6. أكبر مسببات البطء:
   - `AlWaseetContext.jsx` حوالي 5670 سطر: مزامنة + توكنات + كاش + إنشاء طلبات + UI state في ملف واحد.
   - `SuperProvider.jsx` حوالي 3363 سطر، وقيمة context غير memoized، وهذا يسبب re-render واسع.
   - `QuickOrderContent.jsx` حوالي 2759 سطر ويستدعي مدن مباشرة.
   - 1091 console.* في المشروع، مع أن الإنتاج يحذفها عبر terser، لكنها تثقل التطوير وتزعج التشخيص. يجب تنظيفها تدريجياً وليس دفعة واحدة عشوائية.

خطة التنفيذ بعد الموافقة:

المرحلة 1: إصلاح الوسيط جذرياً بدون تغيير منطق الطلبات
- إعادة تثبيت `alwaseet-proxy` ليعيد دائماً استجابة 200 منظمة عند errNum:21 بدلاً من 400 خام حتى لا تظهر شاشة Runtime Error.
- إضافة معلومات آمنة في طلب البروكسي: `partnerName/accountUsername/userId` عند توفرها، حتى يستطيع البروكسي تحديد التوكن المعطوب.
- عند errNum:21:
  - تعطيل التوكن المطابق في `delivery_partner_tokens` (`is_active=false`).
  - تفريغ `delivery_partner_default_token`, `alwaseet_token`, `alwaseet_token_expiry` في المتصفح.
  - إظهار toast واضح فقط: “انتهت جلسة الوسيط، أعد تسجيل الدخول”.
  - إيقاف retries فوراً وعدم تكرار نفس الطلب بنفس التوكن.
- تعديل restore session في `AlWaseetContext` و `UnifiedAuthContext` ليقرأ من قاعدة البيانات أولاً ويتحقق من `expires_at/is_active` ولا يثق بـ localStorage وحده.
- حفظ `expires_at` و `account_username` داخل localStorage عند الحاجة، مع فحصها قبل التفعيل.
- جعل تجديد التوكن عملية مركزية: تحديث صف الحساب نفسه فقط، وتعطيل أي صف مكرر/قديم لنفس `(user_id, partner_name, normalized_username)`.

المرحلة 2: تنظيف قاعدة التوكنات وقيودها
- Migration آمنة تضيف/تثبت دالة normalize username.
- تنظيف التكرارات إن وجدت مع الاحتفاظ بأحدث صف نشط لكل حساب.
- تعديل قيود default بحيث لا يكون هناك إلا حساب default واحد لكل شركة ولكل مستخدم، مع عدم حذف الحسابات الأخرى.
- لا نحذف بيانات حساسة عشوائياً؛ فقط نعطل التوكن المعطوب أو المكرر ونترك الحساب قابل لإعادة تسجيل الدخول.

المرحلة 3: إصلاح كاش MODON بالكامل
- تعديل `region_delivery_mappings` ليكون الربط الفريد الصحيح حسب `(delivery_partner, external_id)` بدلاً من `(region_id, delivery_partner)`، لأن external_id هو هوية شركة التوصيل.
- تعديل `update-modon-cache`:
  - dedupe حسب external_id.
  - إدخال كل المناطق القادمة من MODON في `regions_master`.
  - upsert mapping لكل external_id بدون إسقاط مناطق متشابهة الاسم.
  - تسجيل `regions_fetched` و `regions_mapped` بوضوح حتى لا يظهر sync ناجح وهو ناقص.
- مزامنة package sizes الخاصة بمدن ضمن نفس الكاش إذا لم تكن محدثة.
- بعد التنفيذ: تشغيل sync وفحص العدادات من DB والسجلات للتأكد أن المناطق المخزنة تطابق المجلوبة من API.

المرحلة 4: جعل واجهة مدن تعتمد على الكاش فقط
- تعديل `QuickOrderContent.jsx`:
  - مدن المدن من `city_delivery_mappings + cities_master`.
  - مناطق مدن من `region_delivery_mappings + regions_master` باستخدام external_id الذي تحتاجه API.
  - أحجام الطرود من `package_sizes_cache`.
  - API الخارجي يصبح fallback فقط إذا الكاش فارغ، وليس المسار الأساسي.
- تعديل `AlWaseetContext.fetchCities/fetchRegions` لإزالة `modon_cities_cache` غير الموجود والاعتماد على الجداول الموحدة.

المرحلة 5: أول خطوة تسريع آمنة وقابلة للتراجع
- لا نبدأ بتقسيم الملفات الضخمة مباشرة لأنه أخطر.
- نبدأ بـ `SuperProvider.jsx`:
  - تغليف `contextValue` بـ `useMemo`.
  - تغليف الدوال inline الثقيلة داخل `useCallback` تدريجياً.
  - عدم تغيير شكل القيمة الخارجة حتى لا ينكسر أي مكوّن.
- هذه خطوة قابلة للتراجع بسهولة: ملف واحد، بدون تغيير DB، ونتيجتها تقليل re-renders العام.

المرحلة 6: خطة هيكلية عالمية لاحقة ملفاً ملفاً
- تقسيم `AlWaseetContext` إلى:
  - token/session service.
  - delivery cache service.
  - order sync service.
  - React provider خفيف فقط.
- تقسيم `SuperProvider` إلى data providers حسب المجال: products/orders/accounting/customers.
- تحويل الجلب إلى hooks متخصصة مع cache واضح بدلاً من provider واحد يحمل كل شيء.
- تنظيف console تدريجياً: أولاً الملفات الأكثر تأثيراً (`AlWaseetContext`, `SuperProvider`, `QuickOrderContent`, `modon-api`) واستبدال الضروري بـ `devLog` أو حذفه.

معايير القبول بعد التنفيذ:
- خطأ errNum:21 لا يظهر كشاشة Runtime Error نهائياً.
- عند تلف التوكن، يتم تعطيله ولا يعاد استخدامه تلقائياً.
- عند تجديد التوكن لنفس الحساب، يبقى صف واحد نشط فقط لذلك الحساب.
- مدن تعرض المدن والمناطق والأحجام من الكاش بدون استدعاء API عند فتح الطلب.
- sync مدن لا يسجل success إذا فشل ربط المناطق.
- أول تحسين أداء لا يغير وظائف النظام ولا يمس المخزون أو المال أو الطلبات.