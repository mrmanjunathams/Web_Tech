import 'package:bloggerbytes/main.dart';
import 'package:bloggerbytes/src/api/api_client.dart';
import 'package:bloggerbytes/src/api/posts_api.dart';
import 'package:bloggerbytes/src/router.dart';
import 'package:bloggerbytes/src/state/app_scope.dart';
import 'package:bloggerbytes/src/state/auth.dart';
import 'package:bloggerbytes/src/state/storage.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_backend.dart';

class TestApp {
  TestApp(this.backend, this.services, this.cookies);

  final FakeBackend backend;
  final AppServices services;
  final MemoryCookieStore cookies;
}

/// Pumps the whole app (real router, screens and services) against [backend].
Future<TestApp> pumpApp(
  WidgetTester tester, {
  FakeBackend? backend,
  String location = '/',
  String? signedInAs,
  String name = '',
  Map<String, Object> prefs = const {},
  AssetBundle? bundle,
}) async {
  backend ??= FakeBackend();
  // rootBundle caches loads; one still pending from an earlier test would never complete in this one.
  rootBundle.clear();
  SharedPreferences.setMockInitialValues(prefs);
  final sp = await SharedPreferences.getInstance();
  final cookies = MemoryCookieStore();
  final api = ApiClient(baseUrl: 'http://api.test', client: backend.client, cookies: cookies, manageCookies: true);
  final auth = AuthController(api);
  final services = AppServices(
    posts: PostsApi(api, bundle: bundle),
    auth: auth,
    theme: ThemeController(sp),
    drafts: DraftStore(sp),
  );

  if (signedInAs != null) {
    if (!backend.users.containsKey(signedInAs)) backend.addUser(signedInAs, name: name);
    await tester.runAsync(() => auth.login(username: signedInAs, password: backend!.users[signedInAs]!.password));
  } else {
    await tester.runAsync(auth.load);
  }

  // Phone-sized screen.
  tester.view.physicalSize = const Size(1170, 2532);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    BloggerbytesApp(
      services: services,
      router: buildRouter(auth, initialLocation: location),
    ),
  );
  await settle(tester);
  return TestApp(backend, services, cookies);
}

/// Lets API futures complete and animations finish.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  await tester.pumpAndSettle();
}

/// Scrolls the main list until [finder] is built and visible, then taps it.
Future<void> scrollAndTap(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 300, scrollable: find.byType(Scrollable).first);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await settle(tester);
}
