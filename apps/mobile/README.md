# TradeGuard Mobile

This folder contains the Flutter client for the TradeGuard MVP.

Current flows:

- Live credit lookup against `https://wehom.net/v1/credit/lookup`
- Live evidence submission against `https://wehom.net/v1/evidence/upload`
- Live file picking, evidence upload, and evidence file download
- Adobe Sign sync and certificate status refresh
- Certificate PDF download via backend attachment route

Notes:

- Flutter toolchain is installed and local builds have been validated on this machine.
- The default API base URL is `https://wehom.net/v1`.
- iOS ATS exception is no longer required for `wehom.net`.
- Android cleartext traffic override is no longer required for `wehom.net`.

Validated locally:

1. `flutter analyze`
2. `flutter test`
3. `flutter build ios --simulator --no-codesign`
4. `flutter build apk --debug`
