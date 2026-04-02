import 'package:flutter_test/flutter_test.dart';
import 'package:tradeguard_mobile/main.dart';

void main() {
  testWidgets('TradeGuard app renders tabs', (tester) async {
    await tester.pumpWidget(const TradeGuardApp());

    expect(find.text('风险查询'), findsOneWidget);
    expect(find.text('证据存证'), findsOneWidget);
    expect(find.text('TradeGuard'), findsOneWidget);
  });
}
