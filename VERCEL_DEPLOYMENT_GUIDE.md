# 🚀 دليل النشر على Vercel

## ✅ الملفات الجاهزة

تم إنشاء جميع ملفات التكوين المطلوبة:
- ✅ `vercel.json` - إعدادات النشر والأمان
- ✅ `.vercelignore` - الملفات المستبعدة من النشر
- ✅ `api/alwaseet-webhook.js` - معالج Webhooks
- ✅ `.env.production.example` - مثال لمتغيرات البيئة

---

## 📋 خطوات النشر

### 1️⃣ ربط GitHub من Lovable

1. في Lovable، اضغط على أيقونة **GitHub** (أعلى اليمين)
2. سجل دخول بحساب GitHub
3. اختر **Create Repository** أو ربط repository موجود
4. انتظر حتى يتم نقل الكود

---

### 2️⃣ إنشاء مشروع في Vercel

1. اذهب إلى [vercel.com/new](https://vercel.com/new)
2. سجل دخول بحساب GitHub الخاص بك
3. اضغط **Import Git Repository**
4. اختر الـ repository الذي أنشأته من Lovable

---

### 3️⃣ إعدادات المشروع

في شاشة الإعداد:

**Framework Preset:**
```
Vite
```

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**Root Directory:**
```
./
```

---

### 4️⃣ إضافة Environment Variables

اضغط على **Environment Variables** وأضف:

```
VITE_SUPABASE_URL = https://tkheostkubborwkwzugl.supabase.co
```

```
VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA
```

```
VITE_SUPABASE_PROJECT_ID = tkheostkubborwkwzugl
```

```
NODE_ENV = production
```

**مهم:** تأكد من اختيار **Production, Preview, and Development** لكل متغير.

---

### 5️⃣ النشر

اضغط **Deploy** وانتظر (2-5 دقائق)

---

### 6️⃣ ربط السب دومين

بعد نجاح النشر:

1. في Vercel Dashboard، اذهب لـ **Settings** → **Domains**
2. اضغط **Add Domain**
3. أدخل: `pos.ryusbrand.com`
4. Vercel ستطلب منك إضافة DNS Record

---

### 7️⃣ إعداد DNS في موقع الدومين

في لوحة تحكم الدومين (GoDaddy/Namecheap/etc):

**أضف CNAME Record:**
```
Type: CNAME
Name: pos
Value: cname.vercel-dns.com
TTL: Automatic
```

**أو A Record:**
```
Type: A
Name: pos
Value: 76.76.21.21
TTL: Automatic
```

انتظر 5-15 دقيقة للـ DNS Propagation.

---

### 8️⃣ الحصول على IP Address

بعد ربط الدومين، افتح Terminal/CMD ونفذ:

```bash
nslookup pos.ryusbrand.com
```

أو:

```bash
ping pos.ryusbrand.com
```

ستحصل على IP مثل: `76.76.21.21` أو `76.76.21.98`

---

### 9️⃣ معلومات لشركة التوصيل (AlWaseet)

أعطهم هذه المعلومات:

**Webhook URL:**
```
https://pos.ryusbrand.com/api/alwaseet-webhook
```

**Origin/Domain:**
```
https://pos.ryusbrand.com
```

**IP Address:**
```
76.76.21.21
76.76.21.98
```
(استخدم النتيجة من `nslookup`)

**Method:**
```
POST
```

**Content-Type:**
```
application/json
```

---

## 🔒 ميزات الأمان المفعلة

✅ **SSL/TLS Certificate** - تلقائي من Let's Encrypt  
✅ **Force HTTPS** - إعادة توجيه تلقائية  
✅ **Security Headers:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy
- Referrer-Policy

✅ **CORS Headers** - مفعل لـ API endpoints  
✅ **DDoS Protection** - مفعل افتراضياً  

---

## 🧪 اختبار بعد النشر

### اختبار الموقع:
```bash
curl https://pos.ryusbrand.com
```

### اختبار Webhook:
```bash
curl -X POST https://pos.ryusbrand.com/api/alwaseet-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### اختبار SSL:
```bash
curl -I https://pos.ryusbrand.com
```

---

## 📊 مراقبة الأداء

في Vercel Dashboard:
- **Analytics** - زيارات الموقع
- **Speed Insights** - سرعة التحميل
- **Logs** - سجلات الأخطاء
- **Deployments** - تاريخ النشر

---

## 🔄 النشر التلقائي

بعد الإعداد الأولي:
- أي تغيير في GitHub → نشر تلقائي في Vercel
- أي تغيير في Lovable → يُدفع لـ GitHub → نشر تلقائي

---

## 🆘 حل المشاكل

### المشكلة: Build Failed
**الحل:**
1. تحقق من Environment Variables
2. تأكد من `dist` folder في Output Directory
3. راجع Build Logs في Vercel

### المشكلة: Domain not working
**الحل:**
1. انتظر 15-30 دقيقة للـ DNS Propagation
2. تحقق من DNS Records بـ `nslookup`
3. امسح cache المتصفح (Ctrl+Shift+Delete)

### المشكلة: Webhook لا يعمل
**الحل:**
1. راجع Function Logs في Vercel
2. تحقق من Environment Variables
3. اختبر الـ endpoint بـ `curl`

---

## ✅ Checklist النهائي

- [ ] ربط GitHub من Lovable ✓
- [ ] إنشاء مشروع Vercel ✓
- [ ] إضافة Environment Variables ✓
- [ ] النشر الأولي ✓
- [ ] ربط السب دومين ✓
- [ ] إضافة DNS Records ✓
- [ ] الحصول على IP ✓
- [ ] اختبار الموقع ✓
- [ ] اختبار Webhook ✓
- [ ] إعطاء شركة التوصيل البيانات ✓

---

## 🎉 النتيجة

بعد إكمال جميع الخطوات:
- ✅ الموقع يعمل على `https://pos.ryusbrand.com`
- ✅ SSL مفعل تلقائياً
- ✅ IP ثابت متوفر
- ✅ Webhooks جاهزة
- ✅ Security Headers مفعلة
- ✅ النشر التلقائي من GitHub

**استمتع بموقعك على Vercel! 🚀**
