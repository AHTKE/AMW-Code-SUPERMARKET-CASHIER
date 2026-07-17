# 📦 دليل بناء تطبيق Supermarket Cashier

هذا الملف يشرح **كيف تحصل على كل النسخ** (Windows, macOS, Linux, Android APK) بنفس الشكل الموجود في الصور اللي أرسلتها.

> ⚠️ **مهم جدًا:** Lovable هو محرر ويب فقط، ولا يستطيع إنتاج ملفات `.exe` أو `.apk` بنفسه.
> عشان تطلع النسخ اللي زي الصور، لازم تحمّل المشروع على جهازك (Windows أو Mac أو Linux) وتشغّل الأوامر التالية.

---

## 🖥️ أولًا: نسخ الويندوز (EXE + Portable + Setup) — زي الصورة الأولى

### المتطلبات على جهاز Windows
- Node.js 20+ ([تحميل](https://nodejs.org))
- Git ([تحميل](https://git-scm.com))

### الخطوات
```bash
# 1) حمّل المشروع
git clone <repo-url> supermarket-cashier
cd supermarket-cashier

# 2) ثبّت المكتبات
npm install

# 3) ابنِ نسخ ويندوز (x64 + ia32 + Setup + Portable)
npm run electron:build-win
```

### الناتج داخل مجلد `release/`
ستحصل بالضبط على الملفات التالية (زي الصورة):
- ✅ `Supermarket Cashier-Setup-1.0.0-x64.exe` — مثبّت 64-bit
- ✅ `Supermarket Cashier-Setup-1.0.0-ia32.exe` — مثبّت 32-bit
- ✅ `Supermarket Cashier-Portable-1.0.0-x64.exe` — نسخة محمولة 64-bit
- ✅ `Supermarket Cashier-Portable-1.0.0-ia32.exe` — نسخة محمولة 32-bit
- ✅ ملفات `.blockmap` (للتحديثات التلقائية)
- ✅ `builder-debug.yml` و `builder-effective-config.yaml`
- ✅ مجلدات `win-unpacked/` و `win-ia32-unpacked/`


### ✅ نظام التشغيل المدعوم
هذا المشروع مثبَّت على **Electron 22** (Chromium 108) بشكل مقصود، لأنها آخر
سلسلة Electron تدعم **Windows 7 / 8 / 8.1** إلى جانب Windows 10 و11 (32-bit
و64-bit). لا تقم بترقية Electron إلى 23+ لأن ذلك سيُسقط دعم Win7/8 فورًا (قرار
من Chromium 109).

مشكلة "الألوان الباهتة" التي ظهرت سابقًا سببها أن Tailwind v4 يُصدر ألوانًا
بصيغ حديثة (`oklab` / `oklch` / `color-mix()`) لا يفهمها Chromium 108. تم حلها
عبر خطوة بناء `scripts/downlevel-css.mjs` التي تُحوِّل هذه الصيغ تلقائيًا إلى
sRGB متوافق مع Chromium 108 مع الحفاظ على **نفس الألوان بالضبط** — لا حاجة
لتغيير الواجهة أو ترقية Electron.

---



## 📱 ثانيًا: نسخ Android APK (متعددة المعماريات) — زي الصورة الثانية

### المتطلبات
- [Android Studio](https://developer.android.com/studio) (أحدث نسخة)
- Java JDK 17
- Node.js 20+

### الخطوات
```bash
# 1) ثبّت المكتبات
npm install

# 2) ولّد أيقونات Android/iOS ثم ابنِ الواجهة
npm run mobile:icons
npm run build

# 3) زامن Capacitor مع مجلد android/
npx cap sync android

# 4) ابنِ APKs (Debug — للتجربة)
npm run android:build

# أو Release (للتوزيع)
npm run android:build-release

# أو Android App Bundle للتوزيع على المتجر
npm run android:build-aab
```

### الناتج داخل `android/app/build/outputs/apk/debug/`
تم إعداد المشروع لإنتاج **APK لكل معمارية** (زي الصورة):
- ✅ `app-arm64-v8a-debug.apk` — للأجهزة الحديثة 64-bit
- ✅ `app-armeabi-v7a-debug.apk` — للأجهزة القديمة 32-bit
- ✅ `app-x86-debug.apk` — للمحاكيات 32-bit
- ✅ `app-x86_64-debug.apk` — للمحاكيات 64-bit
- ✅ `app-universal-debug.apk` — يعمل على كل الأجهزة (حجم أكبر)
- ✅ `output-metadata.json`

### فتح المشروع في Android Studio
```bash
npx cap open android
```
ثم من داخل Android Studio: `Build → Build Bundle(s) / APK(s) → Build APK(s)`.

---

## 🍎 ثالثًا: نسخة macOS (تحتاج جهاز Mac)

```bash
npm run electron:build-mac
```
الناتج في `release/`: ملفات `.dmg` و `.zip` لكل من Intel (x64) و Apple Silicon (arm64).

### لو مالكش Mac
- استخدم خدمة سحابية مثل [MacinCloud](https://www.macincloud.com/) أو GitHub Actions مع `macos-latest`.

---

## 🐧 رابعًا: نسخة Linux

```bash
npm run electron:build-linux
```
الناتج: `.AppImage` و `.deb`.

---

## 📱 خامسًا: نسخة iOS

يحتاج جهاز Mac + Xcode. الخطوات:
```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```
ثم من Xcode: `Product → Archive → Distribute App`.

---

## ❓ ليه مش شايف مجلد `android/` عندي؟

المجلد **موجود بالفعل** في المشروع (`/android`)، لكن لو حمّلت zip من Lovable ولم يظهر:
1. تأكد إنك عامل Pull لآخر نسخة عبر GitHub (اضغط زر GitHub في Lovable وربطه).
2. أو حمّل المشروع كـ ZIP من زر **Download** ثم فك الضغط بالكامل.

## ❓ ليه مش بيطلع لي الملفات دي مباشرة من Lovable؟

Lovable يبني ويشغّل نسخة **الويب** فقط داخل المتصفح. إنتاج ملفات `.exe` و `.apk` يحتاج بيئة نظام تشغيل حقيقية (Windows/Mac/Linux) مع Android SDK / Xcode / electron-builder، وده لا يعمل داخل السحابة. الحل هو تحميل المشروع وتشغيل الأوامر أعلاه محليًا.

---

## 🔧 ملخص الأوامر

| المهمة | الأمر |
|---|---|
| بناء ويب فقط | `npm run build` |
| بناء ويندوز (كل النسخ) | `npm run electron:build-win` |
| بناء ماك | `npm run electron:build-mac` |
| بناء لينكس | `npm run electron:build-linux` |
| بناء أندرويد Debug | `npm run android:build` |
| بناء أندرويد Release | `npm run android:build-release` |
| بناء Android AAB | `npm run android:build-aab` |
| مزامنة Capacitor | `npm run cap:sync` |
| فتح Android Studio | `npm run cap:open:android` |
