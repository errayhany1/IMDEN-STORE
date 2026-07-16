# Errayhany Store — App Store & Desktop packaging

## Android (Google Play)
- Package: `com.imden.store`
- Current track: Closed testing (Alpha) — Morocco
- Internal test: https://play.google.com/apps/internaltest/4700737002005896985
- Privacy: https://errayhany.com/privacy-policy.html
- Support: joerihani.com@gmail.com / +212664630566

## iOS (App Store Connect)
Requires: Apple Developer Program ($99/year) + Mac with Xcode.

### Local project (ready)
```bash
npm run build
npx cap sync ios
npx cap open ios
```

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
Use files in `app-store/screenshots/` (iPhone 6.7" and iPad generated from catalog UI).

## Desktop (Windows / Microsoft Store / Mac)
```bash
npm run desktop:build
```
Outputs under `dist-desktop/`:
- Windows NSIS installer (`.exe`)
- Portable `.exe`
- Optional MSIX when Partner Center credentials are configured

PWA install from Chrome/Edge: open https://errayhany.com and use “Install app”.
