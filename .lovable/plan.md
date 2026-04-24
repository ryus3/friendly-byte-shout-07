

# تحديث Edge Functions لاستخدام البروكسي الجديد

## الهدف
تمرير جميع طلبات AlWaseet و MODON عبر السيرفر الوسيط `api.ryusbrand.com` (AWS Lightsail - فرانكفورت) لتجاوز حظر Cloudflare WAF نهائياً، مع الحفاظ على آلية fallback آمنة.

## التغييرات

### 1. `supabase/functions/alwaseet-proxy/index.ts`
- تغيير `ALWASEET_BASE_URL` من:
  ```
  https://api.alwaseet-iq.net/v1/merchant
  ```
  إلى:
  ```
  https://api.ryusbrand.com/alwaseet/v1/merchant
  ```
- إضافة آلية **Fallback ذكية**: إذا فشل البروكسي (timeout/5xx) → يحاول الاتصال المباشر تلقائياً مرة واحدة.
- تسجيل (logging) مصدر الاستجابة (proxy/direct) لمراقبة الأداء.
- الاحتفاظ بكامل منطق Cloudflare detection و rate limiting الحالي.

### 2. `supabase/functions/modon-proxy/index.ts`
- تغيير `MODON_BASE_URL` من:
  ```
  https://mcht.modon-express.net/v1/merchant
  ```
  إلى:
  ```
  https://api.ryusbrand.com/modon/v1/merchant
  ```
- نفس آلية Fallback الذكية.
- الاحتفاظ بكامل منطق FormData و JSON detection و error handling الحالي.

## ما لن يتغيّر (آمن 100%)
- ✅ ملفات الواجهة: `src/lib/alwaseet-api.js`, `src/lib/modon-api.js`
- ✅ Contexts: `AlWaseetContext.jsx`
- ✅ منطق التوكن، الكاش، الطابور (queue)، إعادة المحاولة
- ✅ تجربة المستخدم في الواجهة
- ✅ منطق المزامنة (`sync-order-updates`, `smart-invoice-sync`)
- ✅ كل قواعد البيانات والـ triggers

## الاختبار بعد التعديل
1. مراقبة logs للـ Edge Functions للتأكد من مرور الطلبات عبر `api.ryusbrand.com`.
2. طلب من المستخدم تجربة:
   - تسجيل دخول AlWaseet من الواجهة
   - تسجيل دخول MODON من الواجهة
   - مزامنة الفواتير يدوياً
   - إنشاء طلب تجريبي (اختياري)
3. التحقق من اختفاء أخطاء Cloudflare 403/503.

## التفاصيل التقنية
- البروكسي يعمل على Nginx مع SSL من Let's Encrypt
- IP السيرفر: `52.57.82.157` (فرانكفورت - أوروبا)
- البروكسي يعيد توجيه `/alwaseet/*` → `https://api.alwaseet-iq.net/*`
- البروكسي يعيد توجيه `/modon/*` → `https://mcht.modon-express.net/*`
- الشهادة تُجدد تلقائياً عبر Certbot

## الذاكرة (Memory)
- تحديث `mem://infrastructure/delivery-api-static-proxy-plan` لتعكس أن البروكسي أصبح **مفعّلاً** بدلاً من **مخطط له**.
- إضافة عنوان البروكسي ومسارات routing.

