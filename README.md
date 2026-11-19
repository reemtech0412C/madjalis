# المجالس (Majalis)

برنامج بثّ وتسجيل الدروس العلميّة والخطب والمحاضرات والبودكاست والتلاوات، مع «معمل المجالس» لتعديل المقاطع.
تطبيق Electron (Windows) يعتمد على OBS و ffmpeg المضمَّنين عند البناء.

## التشغيل للتطوير
```
npm install
npx electron .
```
مكوّنات `resources/` (محرّك OBS و`bin/ffmpeg` و`adb`) غير مرفوعة هنا لحجمها؛ تُوضَع يدوياً قبل التشغيل/البناء.

## البناء
```
npx electron-builder            # المثبّت الكامل dist/Majalis-Setup-X.Y.Z.exe
npx electron-builder --dir && node tools/make-update.js   # حزمة التحديث الخفيفة
```

## التحديث
زرّ «تحقّق من التحديث» في «الإعدادات العامة ← حول البرنامج» يقرأ آخر إصدار منشور (Releases) في هذا المستودع.
انشر إصداراً بوسم `vX.Y.Z` وأرفق به أحد الأصلين:
- `Majalis-update-X.Y.Z.zip` و`Majalis-update-X.Y.Z.zip.sha256` (حزمة خفيفة فيها `app.asar`؛ تُطبَّق بعد مطابقة البصمة)
- أو `Majalis-Setup-X.Y.Z.exe` (مثبّت كامل)

نصّ المصحف: Tanzil (الرسم العثماني) — رخصة CC BY 3.0 — tanzil.net
