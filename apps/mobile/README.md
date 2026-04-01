# TradeGuard Mobile

This folder contains the Flutter client for the TradeGuard MVP.

Current flows:

- Live credit lookup against `http://wehom.net/v1/credit/lookup`
- Live evidence submission against `http://wehom.net/v1/evidence/upload`
- Adobe Sign sync and certificate status refresh

Notes:

- Flutter toolchain is installed and local builds have been validated on this machine.
- The default API base URL is `http://wehom.net/v1`.
- iOS ATS exception for `wehom.net` is already configured for current testing.

Validated locally:

1. `flutter analyze`
2. `flutter test`
3. `flutter build ios --simulator --no-codesign`
4. `flutter build apk --debug`
