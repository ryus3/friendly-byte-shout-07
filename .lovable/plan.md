

## شرح كامل: حل AWS EC2 + Elastic IP

### ما هو الحل؟

بدل أن تذهب طلباتنا من Supabase Edge (عناوين IP متغيرة) مباشرة لشركة التوصيل، نضع **خادم وسيط صغير** على AWS بعنوان IP ثابت:

```text
تطبيقك ← Supabase Edge Functions ← خادم AWS (IP ثابت) ← api.alwaseet-iq.net
```

شركة التوصيل تضيف هذا الـ IP الثابت في whitelist وتنتهي المشكلة نهائياً.

---

### التكلفة

| الخدمة | التكلفة الشهرية |
|--------|----------------|
| AWS Lightsail (أرخص خيار) | **3.50$ شهرياً** (512MB RAM) |
| Elastic IP (مجاني إذا مرتبط بخادم شغّال) | **0$** |
| **الإجمالي** | **~3.50$ شهرياً** |

ملاحظة: EC2 t2.micro مجاني لأول 12 شهر (Free Tier)، بعدها ~8$/شهر. Lightsail أبسط وأرخص على المدى الطويل.

---

### هل يؤثر على الأداء؟

- **تأخير إضافي**: 10-50 ميلي ثانية فقط (إذا الخادم في نفس المنطقة الجغرافية)
- **لا تأثير ملحوظ** على تجربة المستخدم
- الكاش المحلي يبقى كما هو، فالخادم يُستخدم فقط للعمليات التي تتطلب API خارجي (إنشاء طلب، مزامنة فواتير، تسجيل دخول)

---

### هل هو حل نهائي؟

**نعم**، لأن:
1. الـ IP ثابت ولا يتغير أبداً
2. شركة التوصيل تضيفه مرة واحدة في whitelist
3. لا يتأثر بتغييرات Supabase أو Cloudflare
4. يمكنك إضافة أي شركة توصيل مستقبلاً من نفس الخادم

---

### خطوات التنفيذ بالتفصيل

**الخطوة 1: إنشاء حساب AWS**
- اذهب إلى aws.amazon.com وأنشئ حساب
- تحتاج بطاقة ائتمان (لن تُخصم إلا حسب الاستخدام)

**الخطوة 2: إنشاء خادم Lightsail**
- من لوحة AWS اختر Lightsail
- اختر: Linux/Unix → Node.js
- اختر أقرب منطقة جغرافية (مثل Bahrain `me-south-1` أو Frankfurt `eu-central-1`)
- اختر الخطة $3.50/شهر
- اضغط Create

**الخطوة 3: ربط Elastic IP**
- من Lightsail → Networking → Create static IP
- اربطه بالخادم الذي أنشأته
- سجّل هذا الـ IP (مثلاً: `15.185.xxx.xxx`)

**الخطوة 4: تثبيت البروكسي على الخادم**
- ادخل الخادم عبر SSH (من المتصفح مباشرة في Lightsail)
- شغّل:
```bash
sudo apt update && sudo apt install -y nodejs npm nginx
mkdir proxy && cd proxy && npm init -y
npm install express node-fetch
```
- أنشئ ملف `server.js` بسيط يعيد توجيه الطلبات لـ `api.alwaseet-iq.net`
- شغّله بـ `pm2` ليبقى يعمل دائماً

**الخطوة 5: تعديل Edge Functions**
- بدل أن يستدعي `alwaseet-proxy` الـ API مباشرة، يستدعي خادمك AWS
- تغيير URL واحد فقط في الكود

**الخطوة 6: إرسال الـ IP لشركة التوصيل**
- أرسل لهم: "هذا عنوان IP الثابت الخاص بنا: `15.185.xxx.xxx` - نرجو إضافته في whitelist"

---

### المشكلة الثانية: المدن والمناطق والأحجام من الكاش

من الفحص الحالي، وجدت هذه المسارات التي **ما زالت تستدعي API خارجي مباشرة**:

| الملف | المشكلة |
|-------|---------|
| `AlWaseetContext.jsx` → `fetchPackageSizes` | يستدعي API مباشرة كل مرة، لا يفحص كاش |
| `AlWaseetContext.jsx` → `fetchRegions` | يستدعي API مباشرة كل مرة، لا يفحص كاش |
| `CreateOrderPage.jsx` | يستدعي `getCities()` و `getRegionsByCity()` من API مباشرة |
| `QuickOrderContent.jsx` → MODON | يستدعي `getCities()` و `getPackageSizes()` من API مباشرة |

**`fetchCities` في `AlWaseetContext`** تم إصلاحها سابقاً (cache-first)، لكن الباقي لم يُصلح.

### الإصلاح المطلوب:

1. **`fetchPackageSizes`**: جلب من جدول `package_sizes` أولاً، fallback للـ API فقط إذا فارغ
2. **`fetchRegions`**: جلب من `regions_master` (الكاش المحلي 6232 منطقة) أولاً
3. **`CreateOrderPage.jsx`**: استخدام المدن والمناطق من `useCitiesCache` بدل API مباشر
4. **`QuickOrderContent.jsx`** (MODON): نفس المنطق - كاش أولاً

### الملفات المطلوب تعديلها:
- `src/contexts/AlWaseetContext.jsx` - إضافة cache-first لـ `fetchPackageSizes` و `fetchRegions`
- `src/pages/CreateOrderPage.jsx` - استخدام الكاش المحلي بدل API
- `src/components/quick-order/QuickOrderContent.jsx` - توحيد MODON مع الكاش

هذا الإصلاح **مستقل تماماً** عن حل AWS ويمكن تنفيذه الآن فوراً.

