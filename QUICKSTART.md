# 🚀 QUICKSTART — بناء التطبيق بأمر واحد

المشروع مُهيّأ بالكامل. حمّل الكود، ثم شغّل الأمر المناسب لنظامك — كل شيء سيعمل بدون رسائل "electron ناقص" أو "أيقونة ناقصة".

## 1) تجهيز واحد لكل الأنظمة

```bash
npm install
```

هذا يثبّت: **Electron 31+ + electron-builder 25 + @capacitor 8 + كل المكتبات**.
ملفات الأيقونة تتولد تلقائياً من `assets/icon.png` داخل `build/icon.ico` و `build/icon.png` و `build/icon.icns` قبل بناء سطح المكتب.

---

## 2) 🖥️ Windows — Setup + Portable (32-bit و 64-bit معاً)

**متطلبات جهاز البناء:** Windows 10/11 + Node.js 20+. النواتج مبنية على **Electron 31+** لأن Chromium الأحدث يدعم ألوان Tailwind v4 الحديثة (`color-mix` / `oklab`) بنفس شكل نسخة الويب.

```bash
npm run electron:build-win
```

النواتج في مجلد `release/`:
- `Supermarket Cashier-Setup-1.0.0-x64.exe` ← مثبّت 64-bit
- `Supermarket Cashier-Setup-1.0.0-ia32.exe` ← مثبّت 32-bit
- `Supermarket Cashier-Portable-1.0.0-x64.exe` ← بورتابل 64-bit
- `Supermarket Cashier-Portable-1.0.0-ia32.exe` ← بورتابل 32-bit

---

## 3) 🍎 macOS

```bash
npm run electron:build-mac
```
النواتج: `.dmg` و `.zip` لـ Intel (x64) و Apple Silicon (arm64) داخل `release/`.

## 4) 🐧 Linux

```bash
npm run electron:build-linux
```
النواتج: `.AppImage` و `.deb` داخل `release/`.

---

## 5) 📱 Android — APK لكل معماريّة

**متطلبات:** Android Studio + JDK 17.

```bash
npm run android:build           # يولّد الأيقونات ثم نسخة Debug
# أو
npm run android:build-release   # يولّد الأيقونات ثم نسخة Release
# أو
npm run android:build-aab       # يولّد Android App Bundle للتوزيع
```

النواتج داخل `android/app/build/outputs/apk/`:
- `app-arm64-v8a-*.apk` — أجهزة حديثة 64-bit
- `app-armeabi-v7a-*.apk` — أجهزة قديمة 32-bit
- `app-x86-*.apk` / `app-x86_64-*.apk` — للمحاكيات
- `app-universal-*.apk` — يعمل على أي جهاز

ملف AAB يظهر داخل `android/app/build/outputs/bundle/release/`.

لفتح المشروع في Android Studio مباشرة:
```bash
npm run cap:open:android
```

---

## 6) 🍏 iOS — يحتاج جهاز Mac + Xcode

أمر واحد يجهّز كل شيء (يثبّت `@capacitor/ios` تلقائياً ويضيف منصة iOS ويعمل sync):

```bash
npm run prepare:ios
npm run cap:open:ios
```

ثم من Xcode: `Product → Archive`.

---

## ✅ ما الذي تم تهيئته مسبقاً؟

- ✅ `electron` + `electron-builder` مثبّتان كـ devDependencies (لن يشتكي أي أمر من نقصهما).
- ✅ `build/icon.ico` متعدّد الأحجام (16→256) و `build/icon.png` 512×512.
- ✅ `electron/main.cjs` يفتح `dist/client/index.html` عبر بروتوكول داخلي `app://` حتى تعمل ملفات JavaScript التفاعلية داخل النسخ المحمولة والمثبتة.
- ✅ بيانات النظام والتفعيل تُحفظ في طبقة تخزين إضافية داخل Electron و Capacitor بجانب `localStorage` حتى لا تختفي بعد Refresh أو إعادة فتح التطبيق.
- ✅ `package.json` مضبوط باسم الشركة `AMW Code` داخل بيانات البرنامج على Windows.
- ✅ `scripts/generate-static-shell.mjs` يُولّد `index.html` بعد كل build (يحلّ الشاشة البيضاء).
- ✅ `vite.config.ts` يستخدم `base: "./"` (روابط نسبية لـ Electron/Capacitor).
- ✅ `android/app/build.gradle` مضبوط لإنتاج **5 نسخ APK** (arm64-v8a, armeabi-v7a, x86, x86_64, universal).
- ✅ `AndroidManifest.xml` فيه صلاحيات INTERNET + CAMERA (للباركود).
- ✅ `capacitor.config.json` يشير إلى `dist/client` (مطابق لناتج vite).
- ✅ appId موحّد: `com.supermarket.cashier.pos`.

## 🔧 ملخّص الأوامر

| المهمة | الأمر |
|---|---|
| تثبيت | `npm install` |
| Windows (Setup + Portable × 32/64) | `npm run electron:build-win` |
| macOS | `npm run electron:build-mac` |
| Linux | `npm run electron:build-linux` |
| Android APK Debug | `npm run android:build` |
| Android APK Release | `npm run android:build-release` |
| Android AAB Release | `npm run android:build-aab` |
| فتح Android Studio | `npm run cap:open:android` |
| تهيئة iOS | `npm run prepare:ios` |
| فتح Xcode | `npm run cap:open:ios` |
