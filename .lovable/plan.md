# خطة الحل الشاملة

## 1) المزامنة الشاملة — حقيقية، سريعة، احترافية

**المشكلة:** التقدّم يقفز من 3% إلى 100% لأن الـedge function يبثّ فقط عند نهاية كل مرحلة (5 نقاط ثابتة)، ولا تُحدَّث النسبة داخل المرحلة. كذلك يجلب 200 فاتورة لكل توكن دفعة واحدة + 25 تفصيل = بطيء.

**الحل:**

### أ. تقدّم حقيقي (داخل كل مرحلة)
- توسيع `reportProgress` لتقبل `current/total` داخل المرحلة، وحساب النسبة الفعلية:
  `pct = stage.start + (current/total) * (stage.end - stage.start)`.
- بثّ بعد كل: فاتورة جُلبت، طلب فاتورة جُلب، طلب مرتبط. (throttle 300ms لتجنّب ضغط Realtime).
- إضافة `current_item` نصّياً ("فاتورة 3343958 - 12/43") لرؤية ما يحدث.

### ب. سرعة "طيارة"
- خفض `MAX_INVOICES_PER_TOKEN` من 200 → **40** (الأحدث + الناقص فقط).
- خفض `ORDER_DETAILS_GAP_MS` من 600 → **150** ms (الـproxy يتحمل).
- موازاة جلب الفواتير من توكنات مختلفة (Promise.all على مستوى التوكن).
- إلغاء `force_refresh` تلقائياً: الاكتفاء بالناقص فقط في المزامنة اليدوية.
- Lock عبر `auto_sync_schedule_settings` (`sync_running=true` + `started_at`) لمنع التشغيل المتوازي. يُفرَّغ بعد 5 دقائق تلقائياً (stale lock cleanup).

### ج. عرض الواجهة
- `SyncProgressStepper`: استبدال شريط القفز بشريط ناعم spring + رقم متحرك (CountUp). إضافة نص "الجاري الآن" تحت الشريط.
- زر إلغاء حقيقي (يضع `status='cancelled'` في DB والـfunction يتوقف عند الفحص بين كل تكرار).

---

## 2) ثورة تصميمية — Bento Dashboard عالمي

**الإلهام:** Apple Health + Linear + Vercel Analytics + Stripe Dashboard. توزيع Bento بأحجام مختلفة، Glassmorphism، حركات micro، خط Space Grotesk.

### التخطيط (Mobile-First → Desktop Bento)

```text
┌──────────────────────────────────────────────────┐
│  HERO: إيرادات اليوم/الشهر (CountUp + Aurora)    │ 2×1
├──────────────────────────┬───────────────────────┤
│  المخزون (Donut SVG)     │  آخر الطلبات          │
│  + 3 تنبيهات حية          │  Timeline أنيق        │
├──────────────────────────┼───────────────────────┤
│  أكثر المنتجات (شريط أفقي│  المحافظات            │
│  + صور مصغّرة + نسب %)   │  🗺 خريطة العراق SVG  │
│                          │  حرارية + Tooltip      │
├──────────────────────────┴───────────────────────┤
│  أفضل الزبائن (قائمة فاخرة برتب ذهبية + شارات)   │
└──────────────────────────────────────────────────┘
```

### الخريطة العراقية (الفكرة الإبداعية المميزة)
- SVG inline لـ18 محافظة (paths فعلية، ليست صورة).
- تظليل حراري حسب عدد الطلبات: مدرّج من `--surface-glass` إلى `--primary-glow`.
- Hover → Tooltip بالاسم + عدد الطلبات + قيمتها.
- Click → فلتر مباشر على قائمة الطلبات.
- المحافظات بدون طلبات تبقى رمادية شفافة.
- على الموبايل: الخريطة قابلة للتكبير (pinch) + بطاقة جانبية بأعلى 5 محافظات.

### بطاقات بإبداع عالمي
- **HeroRevenue:** خلفية Aurora متحركة (CSS conic-gradient + animate)، رقم بـCountUp 60fps، Sparkline صغيرة لآخر 7 أيام.
- **InventoryDonut:** Donut SVG ثنائي الطبقات (متوفر/منخفض/نفذ)، الرقم في المركز يدور عند الـhover.
- **RecentOrdersTimeline:** خط زمني عمودي بنقاط ملوّنة حسب الحالة + Avatars دائرية للزبون + شارة المدينة.
- **TopProductsBar:** شريط أفقي متدرّج (نسبة بصرية)، صورة المنتج 32×32 rounded-xl يسار النص.
- **ProvincesHeatmap:** الخريطة المذكورة أعلاه.
- **TopCustomersLuxury:** قائمة برتب 🥇🥈🥉 ذهبية، شارة "VIP" للأكثر من 5 طلبات، آخر طلب بـ"منذ ٢ يوم".

### Design Tokens (في `index.css`)
```css
--gradient-midnight: linear-gradient(135deg, hsl(240 60% 6%), hsl(245 60% 18%));
--gradient-aurora: linear-gradient(120deg, hsl(245 100% 70%/.4), hsl(280 100% 70%/.3), hsl(190 100% 70%/.3));
--shadow-glass: 0 8px 32px hsl(240 60% 4%/.35), inset 0 1px 0 hsl(0 0% 100%/.06);
--surface-glass: hsl(240 30% 12%/.55);
--gold-rank: hsl(45 90% 60%);
```

### Typography
- إضافة Space Grotesk (عناوين) + DM Sans (أرقام/نصوص) في `index.html`.
- إضافتهما في `tailwind.config.js` تحت `fontFamily`.

---

## 3) إصلاح زر السكرول العائم

**المشكلة:** الزر يظهر دائماً (`visible=true` افتراضياً) ويعتمد فقط على `[data-scroll-container]`/`main`. لكن الصفحة الرئيسية تستخدم body scroll أو حاوية مختلفة، لذلك `scrollTo` يستهدف عنصراً لا يتحرك.

**الحل:**
- اكتشاف الحاوية المتمررة فعلياً: المرور على `document.scrollingElement`، `main`، `[data-scroll-container]`، وأي عنصر بـ`overflow-y:auto` ذو scroll فعّال.
- اختبار `scrollHeight > clientHeight` على كل واحد واختيار الأول الذي يتمرر فعلاً.
- ضبط `scrollTo` على نفس العنصر المكتشف.
- منع الـdrag من ابتلاع الـclick: زيادة عتبة الحركة من 3px → 8px، وضبط `touchAction:'none'` فقط أثناء الـdrag.
- جعله مخفياً افتراضياً (`visible=false`) ويظهر فقط بعد فحص أول scroll يثبت وجود ارتفاع قابل للتمرير.

---

## 📂 الملفات المتأثرة

| المجال | الملف | النوع |
|---|---|---|
| المزامنة | `supabase/functions/smart-invoice-sync/index.ts` | تعديل (throttle progress + سرعة) |
| المزامنة | `src/components/settings/SyncProgressStepper.jsx` | تحسين (CountUp + current_item) |
| المزامنة | `src/components/settings/InvoiceSyncSettings.jsx` | تعديل (زر إلغاء) |
| المزامنة | Migration: lock + cancel فيلد | جديد |
| التصميم | `src/index.css` | tokens جديدة |
| التصميم | `tailwind.config.js` + `index.html` | خطوط |
| التصميم | `dashboard/HeroRevenueCard.jsx` | جديد |
| التصميم | `dashboard/InventoryDonutCard.jsx` | جديد |
| التصميم | `dashboard/RecentOrdersTimeline.jsx` | جديد |
| التصميم | `dashboard/TopProductsBarCard.jsx` | جديد |
| التصميم | `dashboard/ProvincesHeatmapCard.jsx` (+SVG العراق) | جديد |
| التصميم | `dashboard/TopCustomersLuxuryList.jsx` | جديد |
| التصميم | `dashboard/UnifiedDashboard.jsx` + `ManagerDashboardSection.jsx` | تعديل (Bento) |
| السكرول | `src/components/ui/FloatingScrollButton.jsx` | إصلاح |

بعد موافقتك أبدأ التنفيذ مباشرة.
