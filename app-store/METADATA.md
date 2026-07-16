# Errayhany Store — App Store & Desktop packaging

## Android (Google Play)
- Package: `com.imden.store`
- Version: `2.0.0` (versionCode 2)
- Current track: Closed testing (Alpha) — Morocco
- Internal test: https://play.google.com/apps/internaltest/4700737002005896985
- Play listing: https://play.google.com/store/apps/details?id=com.imden.store
- Privacy: https://errayhany.com/privacy-policy.html
- Support: joerihani.com@gmail.com / +212664630566
- Assets: `play-store/final/` and `play-store/upload-*.jpg`
- Build AAB (Windows + Android Studio JBR): `powershell -File scripts/build-android-aab.ps1`
- Latest local AAB: `android/app/build/outputs/bundle/release/app-release.aab` (~210MB)
- Windows portable: `dist-desktop/Errayhany Store 2.0.0.exe` → also `public/downloads/Errayhany-Store-Setup.exe`

### Promote to production
1. Play Console → Testing → Closed testing → promote release to Production
2. Or: Publishing overview → send remaining changes / roll out to Production
3. Add at least 12 closed testers for 14 days if Play requires it before open production

## iOS (App Store Connect)
Requires: Apple Developer Program ($99/year) + Mac with Xcode.

### Local project (ready — version 2.0.0 / build 2)
```bash
npm run ios:prepare
npx cap open ios
```
In Xcode: select Team (signing), Archive → Upload to App Store Connect.

### App Store listing (copy/paste)
- **Name:** Errayhany Store
- **Subtitle:** جملة إلكترونيات المغرب
- **Bundle ID:** com.imden.store
- **Category:** Shopping
- **Age:** 4+
- **Privacy URL:** https://errayhany.com/privacy-policy.html
- **Support URL:** https://errayhany.com/
- **Marketing URL:** https://errayhany.com/

### Description (AR)
Errayhany Store — كتالوج جملة للإلكترونيات وإكسسوارات الهواتف في الدار البيضاء والمغرب.
تصفح المنتجات، أضف للسلة، وأرسل طلبك بسهولة عبر واتساب أو من داخل التطبيق.

### Keywords
جملة,إلكترونيات,إكسسوارات,هواتف,دار البيضاء,مغرب,شواحن,سماعات

### Screenshots
Use files in `app-store/screenshots/` (iPhone and iPad).

### After Apple Team ID is known
Replace `TEAMID` in `public/.well-known/apple-app-site-association` with your real Team ID.

## Desktop (Windows / Microsoft Store / Mac)
```bash
npm run desktop:build
npm run desktop:publish-site
```
- Outputs under `dist-desktop/`
- Site download: https://errayhany.com/download.html
- Installer path served: `/downloads/Errayhany-Store-Setup.exe`

PWA install from Chrome/Edge: open https://errayhany.com and use “Install app”.
