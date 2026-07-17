# دليل بناء تطبيق Android و iOS

تم إعداد المشروع باستخدام **Capacitor** بحيث يمكن فتحه مباشرة في Android Studio وإنتاج ملف APK/AAB.

## بناء APK باستخدام Android Studio

### المتطلبات
- Android Studio (أحدث نسخة).
- Java JDK 17.
- Bun أو Node.js.

### الخطوات
1. حمّل المشروع وافتح Terminal داخله.
2. ثبّت المكتبات:
   ```bash
   bun install
   ```
3. ابنِ الواجهة:
   ```bash
   bun run build
   ```
4. زامن Capacitor مع Android:
   ```bash
   npx cap sync android
   ```
5. افتح Android Studio:
   ```bash
   npx cap open android
   ```
6. من داخل Android Studio:
   - انتظر حتى تنتهي Gradle Sync.
   - `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`.
   - سيظهر مسار ملف الـ APK في نافذة الإشعارات.

### تعديل معرّف التطبيق
- الملف: `capacitor.config.json` → `appId` (حالياً `com.supermarket.cashier.pos`).
- أيقونة التطبيق: استبدل الصور في `android/app/src/main/res/mipmap-*/` أو استخدم أداة Android Studio Image Asset Studio.

### الأذونات (كاميرا الباركود)
افتح `android/app/src/main/AndroidManifest.xml` وأضف داخل `<manifest>`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

## بناء iOS بدون Mac

إذا لم يتوفر لديك جهاز Mac، ارفع رابط النسخة المنشورة على إحدى المنصات:
- **AppMySite** (appmysite.com)
- **GoNative.io** (gonative.io)

المطلوب:
- رابط التطبيق المنشور.
- أيقونة 1024×1024 من `public/icons/icon-512x512.png` (upscale).
- Bundle ID: `com.supermarket.cashier.pos`.

إذا توفّر Mac، يمكنك إضافة منصة iOS مباشرة:
```bash
bun add @capacitor/ios
npx cap add ios
npx cap open ios
```

## ملاحظات
- التطبيق يعتمد على `localStorage` و Telegram API — يعمل داخل WebView بدون مشاكل.
- التطبيق يحفظ بيانات POS والتفعيل أيضاً عبر تخزين Capacitor الأصلي كنسخة احتياطية، لذلك لا يطلب التفعيل مرة أخرى بعد Refresh أو إعادة فتح التطبيق.
- لا يحتاج service worker حالياً.
- إعدادات Capacitor محفوظة في `capacitor.config.json`.
