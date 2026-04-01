# TradeGuard Mobile

This folder contains the Flutter client for the TradeGuard MVP.

Current flows:

- Live credit lookup against `http://wehom.net/v1/credit/lookup`
- Live evidence submission against `http://wehom.net/v1/evidence/upload`
- Adobe Sign sync and certificate status refresh

Notes:

- Flutter CLI is not installed on this machine, so the app was updated but not compiled locally here.
- The default API base URL is `http://wehom.net/v1`.
- If you run this on iOS, add an ATS exception or move the backend to HTTPS first, because Apple blocks plain HTTP by default.

Recommended next steps on a Flutter-enabled machine:

1. `flutter create .`
2. preserve the existing `lib/` files
3. run `flutter pub get`
4. run with `--dart-define=API_BASE_URL=http://wehom.net/v1`
