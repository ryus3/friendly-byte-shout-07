
## الجزء 1 — إصلاح verifier ليقبل IPs Vercel الجديدة

**ملف واحد:** `supabase/functions/verify-custom-domain/index.ts`

أضف IPs Vercel الحديثة إلى قائمة `A_TARGETS`:
```ts
const A_TARGETS = [
  '76.76.21.21',           // legacy
  '64.29.17.1', '64.29.17.65',
  '216.198.79.1', '216.198.79.65',
];
// + قبول أي IP في نطاقي Vercel:
const A_PREFIX_MATCH = ['64.29.17.', '216.198.79.'];
```
وحدّث منطق `aOk` ليطابق إما القائمة الصريحة أو البادئة. حدّث رسالة الخطأ العربية لتذكر القيم الجديدة.

**ما عليك فعله بعد التحديث (خطوة بخطوة):**
1. سجّل دخول كالمدير العام في النظام (`pos.ryusbrand.com`).
2. القائمة → **متجري** → **الدومين**.
3. بجانب `ryusbrand.com` المعلّق، اضغط زر 🔄 (إعادة التحقق).
4. سيظهر "✅ تم التحقق والربط — ryusbrand.com أصبح يفتح متجرك مباشرة".
5. افتح `https://ryusbrand.com` في متصفح آخر → يجب أن يفتح متجرك مباشرة (ليس النظام).

لا تغيير في Cloudflare، لا تغيير في Vercel.

---

## الجزء 2 — السبدومين للموظفين يبقى يدوي ✓

لا أي تعديل برمجي. الموظف يكتب slug فقط في إعدادات متجره، وأنت تضيف الدومين يدوياً في Vercel + Cloudflare ثم يضغط الموظف 🔄 إعادة التحقق. بعد إصلاح verifier سيشتغل تلقائياً.

---

## الجزء 3 — ثورة تصميم المتجر (نهاري + ليلي)

**النطاق:** الصفحة الرئيسية للمتجر فقط (`StorefrontPage.jsx`) — الفئات والمنتجات والسلة والدفع والتتبع جولات لاحقة منفصلة لضمان جودة كل صفحة. أؤكد لك أنني سأكمل البقية في الجولات التالية بنفس الجودة.

### نظام الوضعين (Theme switching)
- يحترم `prefers-color-scheme` تلقائياً + زر تبديل يدوي (☀️/🌙) في الشريط العلوي.
- الحفظ في `localStorage` بمفتاح `storefront-theme`.

### Tokens (في `src/index.css` تحت `.storefront-aurora`)

**Dark (Midnight Aurora — من IMG_2831 و IMG_2843):**
```
bg:        #05060F  (أسود مزرقّ عميق)
surface:   rgba(20,20,50,0.6)
violet:    #7C3AED
cyan:      #22D3EE
fuchsia:   #EC4899
text:      #F5F5FF
border:    rgba(255,255,255,0.10)
glow:      0 0 60px rgba(124,58,237,0.45)
neon-edge: 0 0 0 2px rgba(124,58,237,0.6), 0 0 24px rgba(34,211,238,0.4)
```

**Light (Pearl Aurora — من IMG_2832 و IMG_2844):**
```
bg:        #F5F4FF  (أبيض مزرق ناعم)
surface:   rgba(255,255,255,0.65)
violet:    #6D28D9
cyan:      #06B6D4
fuchsia:   #DB2777
text:      #0F172A
border:    rgba(15,23,42,0.08)
glow:      0 12px 40px rgba(124,58,237,0.20)
neon-edge: 0 0 0 1px rgba(124,58,237,0.30), 0 8px 32px rgba(34,211,238,0.25)
```

### بنية الصفحة الرئيسية

```text
┌──────────────────────────────────────────────────────┐
│  Aurora Backdrop (Blobs متحركة + Grid + Noise)       │
├──────────────────────────────────────────────────────┤
│  Glass Top Bar: شعار • بحث زجاجي • ☀️🌙 • سلة 🛒   │
├──────────────────────────────────────────────────────┤
│  HERO CAROUSEL (مستوحى من IMG_2831 + IMG_2844)       │
│   - بطاقة كبيرة زجاجية: عنوان + خصم 60% + زر CTA   │
│   - صور منتجات عائمة 3D + spotlight يتبع الإصبع    │
│   - مؤشرات نقطية متحركة (auto-rotate كل 5 ثوانٍ)   │
├──────────────────────────────────────────────────────┤
│  CATEGORY ORBS (مستوحى من IMG_2832 + IMG_2843)       │
│   - دوائر زجاجية كبيرة بصور + اسم الفئة + توهج      │
│   - أفقي قابل للسحب، Snap scrolling                  │
│   - حدود نيون تتدرج violet→cyan في الظلام            │
├──────────────────────────────────────────────────────┤
│  FLASH DEALS RAIL (مستوحى من IMG_2831)               │
│   - بطاقات أفقية مع عداد تنازلي حيّ                 │
│   - شارة "خصم %" مع تأثير pulse                     │
│   - سعر قديم مشطوب + سعر جديد بارز                  │
├──────────────────────────────────────────────────────┤
│  FEATURED BENTO (مستوحى من IMG_2843)                 │
│   - شبكة Bento: 1 كبيرة + 4 صغيرة بأحجام مختلفة    │
│   - كل بطاقة 3D tilt + Quick View 👁                │
│   - شارة "جديد/حصري/الأكثر مبيعاً" متحركة          │
├──────────────────────────────────────────────────────┤
│  STORY REELS (مستوحى من IMG_2844 — قصص فيديو)        │
│   - دوائر/مستطيلات عمودية مع زر تشغيل ▶            │
│   - حدود متدرجة دائرية (Instagram-style)             │
│   - افتح Modal لعرض ريل المنتج                       │
├──────────────────────────────────────────────────────┤
│  ALL PRODUCTS GRID — 2/3/4 columns حسب الشاشة        │
├──────────────────────────────────────────────────────┤
│  TRUST STRIP زجاجي: شحن سريع • ضمان • إرجاع • دفع آمن│
├──────────────────────────────────────────────────────┤
│  Glass Footer مع روابط + سوشيال                      │
└──────────────────────────────────────────────────────┘

          ┌─────────────────────────┐
          │  Sticky Mini-Cart 🛒    │  عائم أسفل يمين
          │     3 • 87,500 د.ع      │  (يتحرك مع scroll)
          └─────────────────────────┘
```

### المكوّنات الجديدة (`src/components/storefront/aurora/`)
- `AuroraBackdrop.jsx` — blobs متحركة + grid + noise، يبدل لون حسب theme.
- `GlassCard.jsx` — البطاقة الزجاجية الأساسية بـ `backdrop-blur` و border حسب theme.
- `ThemeToggle.jsx` — زر ☀️/🌙 مع animation انتقال.
- `HeroCarousel.jsx` — Hero بمنتجات 3D + spotlight يتبع الماوس/اللمس.
- `CategoryOrbs.jsx` — شريط فئات دائري قابل للسحب.
- `FlashDealsRail.jsx` — صفقات مع عداد تنازلي.
- `BentoFeatured.jsx` — شبكة Bento بـ 3D tilt.
- `StoryReels.jsx` — قصص فيديو دائرية.
- `ProductCardAurora.jsx` — بطاقة منتج (تُستخدم في Bento و Grid).
- `StickyMiniCart.jsx` — سلة عائمة.
- `TrustStrip.jsx` — شريط الثقة الزجاجي.
- `GlassFooter.jsx` — تذييل زجاجي.

### تأثيرات تفاعلية أساسية
- **3D Tilt** على بطاقات المنتج: `transform: perspective(1000px) rotateX(...) rotateY(...)` يُحسب من `mousemove`/`touchmove` عبر CSS variables — بدون مكتبات.
- **Spotlight** على Hero: gradient شعاعي يتبع الماوس عبر `--mx/--my`.
- **Neon Border** للفئات (في الظلام): conic-gradient متحرك حول الحواف.
- **Pulse** على شارات الخصم والـ Flash Deals.
- **Auto-rotate** للـ Hero كل 5 ثوانٍ (يتوقف عند hover).
- **Smooth scroll snap** للـ Category Orbs و Story Reels.

### إبقاء المنطق كاملاً
- نفس `useStorefrontSettings`, `useShoppingCart`, `useActivePromotions`, `useProductRecommendations`.
- نفس روابط `/storefront/{slug}/products`, `/cart`, `/product/{id}`.
- لا تغيير في DB أو RLS أو edge functions.

### الجولات القادمة (سأكملها واحدة تلو الأخرى بعد اعتماد هذه)
1. صفحة الفئات (IMG_2832 — Orbs + Side rail)
2. صفحة تفاصيل المنتج (IMG_2821 — معرض كبير + ألوان + مقاسات + AR-style)
3. سلة + دفع (Glass drawer + خطوات أنيقة)
4. صفحة التتبع (IMG_2826 — خريطة + timeline زجاجي ملوّن)
5. مساعد المقاس الذكي (IMG_2819)

## ما لن يتغيّر
- منطق الطلبات وشركة التوصيل
- `pos.ryusbrand.com` (النظام)
- إعدادات Vercel و Cloudflare
