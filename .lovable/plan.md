
# الخطة النهائية المعدّلة (بعد تأكيد ملاحظاتك من قاعدة البيانات)

---

## 1) لماذا الطلب يختفي بعد ثوانٍ ثم يعود بعد 10 دقائق أو إعادة فتح الموقع — السبب القاطع

تأكدت من قاعدة البيانات: آخر طلب فعلي محفوظ في DB قبل اليوم. الـ "10 دقائق ثم يظهر" هو **بصمة واضحة لـ cache**. السبب الحقيقي:

في `src/api/SuperAPI.js`:
- يوجد طبقتا cache: ذاكرة (`this.cache`) و **localStorage مستمر** (`this.persistPrefix + key`).
- `CACHE_TTL = 10 دقائق` للبيانات العامة (السطر 19) — هذا هو مصدر "10 دقائق بالضبط".
- عند إنشاء طلب، `createOrder` في `SuperProvider` يستدعي `superAPI.invalidate('all_data')` — لكن `invalidate` يمسح **الذاكرة فقط** ولا يمسح `localStorage`. ثم أي `fetchAllData` تالٍ يقرأ النسخة القديمة من `localStorage` عبر `readPersisted` (السطر 76-86) فيعود الطلب الجديد للاختفاء، حتى تنتهي الـ 10 دقائق أو يُعاد تحميل الصفحة.

**الإصلاح الجذري (جراحي، آمن 100%):**

أ) في `SuperAPI.invalidate(key)`: **مسح localStorage أيضاً**:
```js
invalidate(key) {
  this.cache.delete(key);
  this.timestamps.delete(key);
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(this.persistPrefix + key); } catch {}
  }
}
```

ب) تقصير `ORDER_CACHE_TTL` من 30 ثانية إلى 10 ثوانٍ، و **عدم استخدام `readPersisted` لمفاتيح الطلبات** (`all_data`, `orders_only`)، حتى لا يخدم localStorage بيانات قديمة عن الطلبات أبداً:
```js
// في fetch():
if (!force && typeof window !== 'undefined' && !key.includes('order') && !key.includes('all_data')) {
  const persisted = this.readPersisted(key);
  ...
}
```

ج) إصلاح خطأ `prev` خارج callback في `SuperProvider.jsx` السطر 1266 (مشروح في الخطة السابقة) حتى لا يفشل التزامن الخلفي للطلب الجديد بصمت.

د) في `fetchAllData` (السطر 520): دمج الطلبات اللحظية الحديثة مع البيانات المجلوبة بدل الاستبدال الكامل (لمنع اختفاء الطلب لأي سبب آخر).

النتيجة: الطلب الجديد يظهر فوراً عند الإنشاء، ويبقى ظاهراً، ولن يختفي أبداً. الإصلاح لا يمس أي منطق مالي أو مخزني.

---

## 2) حذف قاعدة الربح — تأكيد قاطع من DB

تأكدت: عند الضغط على "حذف"، الصف فعلياً يُحدّث في DB (`is_active=false`) بنجاح — رأيت 11 صف تم تحديثه اليوم في `2026-04-30 01:48-01:49`. لكن القاعدة تظل ظاهرة في الواجهة لأن:

- `setEmployeeProfitRule` يستدعي `superAPI.invalidate('all_data')` ثم `fetchAllData()`.
- لكن (نفس مشكلة #1) `localStorage` يحتفظ بنسخة قديمة فيها `is_active=true` ⇒ يتم استرجاعها فوراً ⇒ القاعدة تعود للظهور.

**الإصلاح يأتي تلقائياً مع إصلاح #1 (مسح localStorage عند invalidate).** بالإضافة، لتحسين الموثوقية:

أ) تحويل الحذف من **soft delete إلى hard delete** (طلبك الصريح: "تحذف القاعدة بشكل كامل"):
```js
// في SuperProvider.setEmployeeProfitRule
if (ruleData.id && ruleData.is_active === false) {
  const { error } = await supabase
    .from('employee_profit_rules')
    .delete()  // ✅ DELETE فعلي بدلاً من UPDATE
    .eq('id', ruleData.id);
  if (error) throw error;
}
```

ب) **تحديث local state فوراً** قبل `fetchAllData` ليختفي الصف من الواجهة على الفور:
```js
setAllData(prev => ({
  ...prev,
  employeeProfitRules: (prev.employeeProfitRules || []).filter(r => r.id !== ruleData.id)
}));
```

النتيجة: الضغط على "حذف" يحذف القاعدة من DB **فوراً ونهائياً** ومن الواجهة **بنفس اللحظة**.

⚠️ ملاحظة هامة بخصوص ذاكرة المشروع (`employee-profit-rules-time-validity-critical`): القواعد لها صلاحية زمنية عبر `created_at` بحيث تنطبق على الطلبات اللاحقة لإنشاء القاعدة. الحذف الفعلي **لا يؤثر على الطلبات السابقة المُحتسبة بالفعل** لأن الأرباح محسوبة ومخزّنة مسبقاً في جدول `profits`. لذا الحذف الجذري آمن. سأتأكد من هذا قبل التنفيذ بفحص المراجع الخارجية لـ `rule_id`.

---

## 3) "تم التسليم" يقرأ 2 — حُلّت

نفس الإصلاح المتفق عليه في الخطة السابقة: استثناء `status='completed'` و`status='returned_in_stock'` من فلتر `delivered` في `OrdersStats.jsx`. هذا يطابق طلبك الصريح: "تم التسليم وبدون مستحقات ومستلم الفاتورة يجب أن يكون أرشيف". ✅

---

## 4) باقي الخطة (ممتازة كما وصفت)

- إصلاح زر المزامنة (القفز للأعلى) عبر `role="button"` و`stopPropagation`.
- إصلاح بروكسي MODON في edge function.
- heartbeat على `orders.updated_at`.
- تأكيد توجيه الإيراد لقاصة مالك المنتج (أحمد).
- إنشاء `robots.txt`.

---

## 5) التحذيرات والأخطاء — أيها آمن وأيها ممنوع لمسه

سؤالك مشروع جداً، والجواب الصريح: **بعض هذه التحذيرات لا تُلمس أبداً**. سابقاً تم كسر بوت التليغرام لأن **`search_path` تم تعديلها على دوال SECURITY DEFINER التي يستخدمها البوت** (مذكور في memory: AlWaseet/MODON tokens، triggers، telegram-bot). هذا الدرس محفوظ.

### ✅ آمنة 100% — يمكن إصلاحها بدون أي خطر

| التحذير | لماذا آمن | الإصلاح |
|--------|----------|---------|
| **robots.txt غير صالح (SEO)** | ملف ثابت في `public/`، لا علاقة له بالكود | إنشاء ملف بسيط |
| **Public Bucket Allows Listing** | تأمين قائمة الملفات لا يمنع الوصول للملف نفسه | إيقاف list من إعدادات الـ bucket فقط |
| **Leaked Password Protection Disabled** | إعداد في Supabase Auth dashboard | تفعيل من dashboard، لا كود |
| **RLS Policy Always True** (إذا كانت على جدول analytics فقط) | بعد التحقق من الجدول المحدد | تشديد بعد فحص دقيق لكل سياسة على حدة |

### ⚠️ تحتاج حذراً شديداً — سأنفذها واحدة واحدة بعد فحص كل دالة

| التحذير | لماذا حذِر | الخطة الآمنة |
|--------|-----------|--------------|
| **Function Search Path Mutable** (مئات الدوال) | هذه هي التي كسرت البوت سابقاً! دوال SECURITY DEFINER تعتمد على دقة الجداول المُلتقطة | **لن أعدّل بشكل جماعي**. سأعدّل دالة واحدة فقط في كل migration، أبدأ بدوال غير مرتبطة بالبوت/الطلبات/الفواتير، وأتحقق بعد كل تعديل. الدوال المرتبطة بـ `telegram-bot`, `auto_create_*`, `handle_order_*`, `process_invoice_*` **سأتركها كما هي** أو أعدّلها بحذر شديد بعد موافقتك المنفصلة |
| **SECURITY DEFINER missing search_path** | نفس السبب أعلاه | نفس النهج |
| **Critical vulnerabilities in dependencies** | قد يغير سلوك حزم runtime | فحص `npm audit` فقط للحزم الحرجة (Supabase JS, React)، تجنب أي ترقية كبيرة |
| **Sensitive state in localStorage** | البوت/التطبيق قد يعتمدان على بعض هذه المفاتيح | تنظيف فقط للمفاتيح المعروفة كـ legacy، مع قائمة بيضاء |

### 🚫 لن أمسها أبداً (أو فقط بعد طلبك الصريح بكل واحدة)

| التحذير | لماذا |
|--------|-------|
| **Realtime: any authenticated user can subscribe** | تشديد RLS على `realtime.messages` قد يقطع الاشتراكات الموجودة في كل المكونات (orders, ai_orders, products …). يحتاج اختبار شامل. **سأقترح تنفيذها كخطوة منفصلة** بعد تأكيدك |
| **employee Telegram codes RLS** | جدول مرتبط مباشرة بالبوت! تشديد RLS قد يمنع البوت من قراءة/تحديث الأكواد ⇒ **كسر البوت** | متروك حتى نراجع بدقة كيف يصل البوت لهذا الجدول (هل عبر service_role أم عبر user؟) |
| **storefront_analytics overwritable by anon** | الواجهة العامة قد تعتمد عليه | فحص المصدر قبل التشديد |
| **Product cache refresh endpoint lacks auth** | edge function عام لتحديث cache المنتجات | إضافة JWT ستكسر أي cron يستدعيها بدون توكن — يحتاج مراجعة الـ cron أولاً |
| **Delivery partner API token hardcoded** (outdated) | علامة "outdated" تعني أنه من فحص قديم وقد يكون أُصلح. **سأبحث في الكود الحالي**؛ إن لم أجد توكن hardcoded، أتجاهل التحذير بأمان |

### القرار الذي أقترحه عليك

في هذه الجولة سأنفذ من الأمان الكامل فقط:
1. `robots.txt`
2. Public Bucket Listing (إعداد بسيط)
3. Leaked Password Protection (إعداد في Auth dashboard — قد تحتاج تفعيله بنفسك)

أما باقي التحذيرات (خاصة search_path، Realtime RLS، Telegram codes) **أتركها لجولة منفصلة** حيث:
- نختار جدول/دالة واحدة في كل مرة
- نختبر بعد كل تعديل
- لا نلمس أي شيء له علاقة بـ telegram_bot/orders/invoices/auto_*

هل توافق على هذه الفلسفة؟ إن كانت إجابتك "نعم"، أبدأ بالتنفيذ.

---

## ملخص قائمة التنفيذ النهائية (بعد موافقتك)

### إصلاحات وظيفية (بدون أي مخاطرة)
1. ✅ `SuperAPI.js`: `invalidate` يمسح localStorage + استثناء مفاتيح الطلبات من `readPersisted` + تقصير TTL للطلبات.
2. ✅ `SuperProvider.jsx`: 
   - إصلاح `prev.users` خارج callback (السطر 1266).
   - حماية الطلبات اللحظية في `fetchAllData`.
   - تمرير `profits` لـ `addOrderInstantly`.
   - تحويل حذف قاعدة الربح إلى **DELETE فعلي** + تحديث state فوراً.
3. ✅ `OrdersStats.jsx`: استثناء `completed`/`returned_in_stock` من كرت "تم التسليم".
4. ✅ `SyncStatusIndicator.jsx`: `role="button"` + `stopPropagation`.
5. ✅ `sync-order-updates` edge function: استخدام بروكسي MODON الثابت + heartbeat على `updated_at`.

### إصلاحات أمنية (آمنة فقط)
6. ✅ `public/robots.txt`.
7. ✅ Public Bucket: إيقاف list فقط.
8. 📌 Leaked Password Protection: تعليمات لتفعيله في dashboard.

### مؤجّل (لجولة منفصلة بموافقتك)
- search_path على دوال SECURITY DEFINER (دالة واحدة في كل مرة).
- Realtime RLS.
- telegram_employee_codes RLS.
- storefront_analytics RLS.
- Product cache refresh auth.

**ضمانات صريحة:**
- لن أعدّل أي trigger أو function متعلق بـ: telegram_bot, auto_create_*, handle_order_*, process_invoice_*, calculate_*_profit, reserve_stock_*.
- لن أعدّل أي منطق مالي أو مخزني.
- لن أرفع dependencies ترفعاً كبيراً (major versions).
- كل تعديل DB سيكون migration واحدة محدودة قابلة للتراجع.

هل أبدأ بالتنفيذ؟
