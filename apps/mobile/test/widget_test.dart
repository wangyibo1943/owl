import 'package:flutter_test/flutter_test.dart';
import 'package:tradeguard_mobile/main.dart';

void main() {
  testWidgets('TradeGuard app renders tabs', (tester) async {
    await tester.pumpWidget(const TradeGuardApp());

    expect(find.text('Credit'), findsOneWidget);
    expect(find.text('Evidence'), findsOneWidget);
    expect(find.text('TradeGuard'), findsOneWidget);
  });
}
