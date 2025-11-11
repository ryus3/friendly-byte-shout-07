# 📱 دليل إعداد أيقونة التطبيق للهاتف

## 🎨 الصورة الأصلية
الصورة الأصلية موجودة في: `public/app-icon-original.png`

---

## 📋 المتطلبات

### **iOS Icons**
يجب إنشاء الأحجام التالية بصيغة PNG (بدون شفافية):

| الحجم | الاسم | الاستخدام |
|------|------|----------|
| 20x20 | icon-20.png | iPhone Notification 2x |
| 29x29 | icon-29.png | iPhone Settings 2x |
| 40x40 | icon-40.png | iPhone Spotlight 2x |
| 58x58 | icon-58.png | iPhone Settings 3x |
| 60x60 | icon-60.png | iPhone App 2x |
| 76x76 | icon-76.png | iPad App 1x |
| 80x80 | icon-80.png | iPhone Spotlight 3x |
| 87x87 | icon-87.png | iPhone Settings 3x |
| 120x120 | icon-120.png | iPhone App 3x |
| 152x152 | icon-152.png | iPad App 2x |
| 167x167 | icon-167.png | iPad Pro App 2x |
| 180x180 | icon-180.png | iPhone App 3x |
| 1024x1024 | icon-1024.png | App Store |

**الموقع:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

---

### **Android Icons**
يجب إنشاء الأحجام التالية بصيغة PNG:

| الكثافة | الحجم | الاسم | المجلد |
|---------|------|------|--------|
| mdpi | 48x48 | ic_launcher.png | android/app/src/main/res/mipmap-mdpi/ |
| hdpi | 72x72 | ic_launcher.png | android/app/src/main/res/mipmap-hdpi/ |
| xhdpi | 96x96 | ic_launcher.png | android/app/src/main/res/mipmap-xhdpi/ |
| xxhdpi | 144x144 | ic_launcher.png | android/app/src/main/res/mipmap-xxhdpi/ |
| xxxhdpi | 192x192 | ic_launcher.png | android/app/src/main/res/mipmap-xxxhdpi/ |

---

## 🔧 خطوات التطبيق

### 1. إنشاء الأيقونات
استخدم أداة مثل:
- [App Icon Generator](https://www.appicon.co/)
- [Icon Kitchen](https://icon.kitchen/)
- Photoshop/Figma (يدوياً)

رفع الصورة الأصلية `public/app-icon-original.png` وتوليد جميع الأحجام المطلوبة.

---

### 2. نسخ الأيقونات

**iOS:**
```bash
# نسخ جميع الأيقونات إلى:
ios/App/App/Assets.xcassets/AppIcon.appiconset/

# تحديث Contents.json ليطابق الأيقونات الجديدة
```

**Android:**
```bash
# نسخ الأيقونات إلى المجلدات المناسبة:
android/app/src/main/res/mipmap-mdpi/ic_launcher.png
android/app/src/main/res/mipmap-hdpi/ic_launcher.png
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
```

---

### 3. مزامنة مع Native Projects

```bash
# بعد نسخ جميع الأيقونات:
npx cap sync
```

---

### 4. اختبار محلياً

**iOS (يحتاج Mac + Xcode):**
```bash
npx cap run ios
```

**Android (يحتاج Android Studio):**
```bash
npx cap run android
```

---

## ⚠️ ملاحظات مهمة

### 1. **تغيير الأيقونة يحتاج رفع نسخة جديدة للـ Store**
- تغيير الأيقونة **لا يظهر فوراً** للمستخدمين
- يجب رفع نسخة جديدة لـ **App Store** و **Google Play Store**
- بعد الموافقة والنشر، سيرى المستخدمون الأيقونة الجديدة

### 2. **تحديثات الكود تصل فوراً (بدون رفع للـ Store)**
- جميع تحديثات React/JS/CSS/HTML
- إصلاحات الأخطاء والميزات الجديدة
- تحديثات قاعدة البيانات والـ Edge Functions

**السبب:** التطبيق يحمّل المحتوى من:
```
https://5a9f8315-d7f4-4708-9260-f85606ca37a8.lovableproject.com
```

### 3. **متطلبات الصور**
- **iOS:** PNG بدون شفافية (خلفية ملونة)
- **Android:** PNG (يمكن مع شفافية)
- جودة عالية (avoid pixelation)
- ألوان واضحة ومميزة

---

## 📚 مراجع مفيدة

- [Apple Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Android Icon Guidelines](https://developer.android.com/guide/practices/ui_guidelines/icon_design_launcher)
- [Capacitor Documentation](https://capacitorjs.com/docs/guides/splash-screens-and-icons)

---

## ✅ الخلاصة

1. ✅ الصورة الأصلية محفوظة في `public/app-icon-original.png`
2. ⏳ استخدم أداة توليد أيقونات لإنشاء جميع الأحجام
3. ⏳ انسخ الأيقونات للمجلدات المناسبة (iOS & Android)
4. ⏳ نفذ `npx cap sync`
5. ⏳ اختبر محلياً (iOS & Android)
6. ⏳ ارفع نسخة جديدة للـ App Store & Play Store

**ملاحظة:** الخطوات 2-6 تحتاج تنفيذ يدوي أو استخدام أدوات خارجية لتوليد الأيقونات.
