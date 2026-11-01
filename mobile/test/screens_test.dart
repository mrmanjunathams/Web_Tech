// Every screen and control not exercised by the flow tests: menus, links, errors, refreshes, empty states.
import 'package:bloggerbytes/main.dart' as app;
import 'package:bloggerbytes/src/api/api_client.dart';
import 'package:bloggerbytes/src/api/models.dart';
import 'package:bloggerbytes/src/api/posts_api.dart';
import 'package:bloggerbytes/src/config.dart';
import 'package:bloggerbytes/src/state/storage.dart';
import 'package:bloggerbytes/src/ui/screens/about.dart';
import 'package:bloggerbytes/src/ui/screens/account.dart';
import 'package:bloggerbytes/src/ui/screens/explore.dart';
import 'package:bloggerbytes/src/ui/screens/login.dart';
import 'package:bloggerbytes/src/ui/screens/post.dart';
import 'package:bloggerbytes/src/ui/screens/signup.dart';
import 'package:bloggerbytes/src/ui/screens/write.dart';
import 'package:bloggerbytes/src/ui/theme.dart';
import 'package:bloggerbytes/src/ui/widgets/feedback.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:share_plus_platform_interface/share_plus_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

import 'support/fake_backend.dart';
import 'support/fakes.dart';
import 'support/harness.dart';

late FakeLauncher launcher;
late FakeShare share;

/// Taps [finder] after scrolling it into view on the first visible list.
Future<void> tapIn(WidgetTester tester, Finder finder) async {
  scaffoldMessengerKey.currentState?.clearSnackBars();
  tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0); // search from the top
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(finder, 300, scrollable: find.byType(Scrollable).first);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await settle(tester);
}

/// The button (of any style) labelled [label].
Finder button(String label) => find.ancestor(of: find.text(label), matching: find.bySubtype<ButtonStyleButton>());

GoRouter routerOf(WidgetTester tester) => GoRouter.of(tester.element(find.byType(Scaffold).first));

/// Scrolls to the top, then pulls down to refresh.
Future<void> pullToRefresh(WidgetTester tester) async {
  tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0); // (a drag would refresh too)
  await settle(tester);
  await tester.fling(find.byType(Scrollable).first, const Offset(0, 500), 1500);
  await settle(tester);
}

void main() {
  setUp(() {
    launcher = FakeLauncher();
    share = FakeShare();
    UrlLauncherPlatform.instance = launcher;
    SharePlatform.instance = share;
  });

  group('plumbing', () {
    test('config resolves defines and defaults', () {
      expect(AppConfig.apiBaseUrlFor('https://api.example/', TargetPlatform.iOS, isWeb: false), 'https://api.example');
      expect(AppConfig.apiBaseUrlFor('', TargetPlatform.android, isWeb: false), 'http://10.0.2.2:3000');
      expect(AppConfig.apiBaseUrlFor('', TargetPlatform.android, isWeb: true), 'http://localhost:3000');
      expect(AppConfig.siteUrlFor('https://site.example/', 'x'), 'https://site.example');
      expect(AppConfig.siteUrlFor('', 'https://api'), 'https://api');
      expect(AppConfig.siteUrl, AppConfig.apiBaseUrl);
    });

    test('API client details', () async {
      expect(const ApiException(404, 'x').toString(), 'ApiException(404, x)');
      expect(ApiClient(baseUrl: 'http://x'), isNotNull); // default (platform) HTTP client
      final api = ApiClient(baseUrl: 'http://x', client: MockClient((_) async => http.Response('<html>not json', 200)));
      expect(await api.get('/'), isNull);
      final posts = PostsApi(ApiClient(baseUrl: 'http://x', client: MockClient((_) async => http.Response('{}', 200))));
      expect(await posts.leaderboard(), isEmpty);
    });

    test('persisted cookie store, palette, models', () async {
      SharedPreferences.setMockInitialValues({});
      final store = PrefsCookieStore(await SharedPreferences.getInstance());
      expect(store.read(), isNull);
      await store.write('abc');
      expect(store.read(), 'abc');
      await store.write(null);
      expect(store.read(), isNull);
      expect(Palette.dark.copyWith(), same(Palette.dark));
      expect(Palette.dark.lerp(null, .5), same(Palette.dark));
      const b = BlogPost(
        id: 'x',
        auth: 'a',
        title: 't',
        cate: '',
        date: '',
        img: '',
        blogp1: '',
        blogp2: '',
        likes: 2,
        liked: true,
      );
      expect((b.copyWith().likes, b.copyWith().liked), (2, true));
    });

    testWidgets('main() starts the app (signed out when the API is unreachable)', (tester) async {
      SharedPreferences.setMockInitialValues({});
      await app.main();
      await settle(tester);
      expect(find.text('Publish your passions,'), findsOneWidget);
    });

    testWidgets('unknown routes go home', (tester) async {
      await pumpApp(tester, location: '/no/such/page');
      expect(find.text('Publish your passions,'), findsOneWidget);
    });
  });

  group('shell', () {
    testWidgets('drawer: every destination, signed out', (tester) async {
      await pumpApp(tester);
      Future<void> open(String label) async {
        tester.state<ScaffoldState>(find.byType(Scaffold).first).openDrawer();
        await settle(tester);
        await tester.tap(find.descendant(of: find.byType(Drawer), matching: find.text(label)));
        await settle(tester);
      }

      for (final label in ['Stories', 'Explore', 'Leaderboard', 'Image Pool', 'Home']) {
        await open(label);
      }
      await open('About');
      expect(find.byType(AboutScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await open('Sign in');
      expect(find.byType(LoginScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await open('Create account');
      expect(find.byType(SignupScreen), findsOneWidget);
    });

    testWidgets('drawer and account menu, signed in; logo goes home', (tester) async {
      final t = await pumpApp(tester, signedInAs: 'amy', name: 'Amy Writer', location: '/cate');
      Future<void> drawer(String label) async {
        tester.state<ScaffoldState>(find.byType(Scaffold).first).openDrawer();
        await settle(tester);
        await tester.tap(find.descendant(of: find.byType(Drawer), matching: find.text(label)));
        await settle(tester);
      }

      await drawer('Dashboard');
      expect(find.byType(AccountScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await drawer('Write');
      expect(find.byType(WriteScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);

      Future<void> menu(String label) async {
        await tester.tap(find.byTooltip('Account menu'));
        await settle(tester);
        await tester.tap(find.text(label));
        await settle(tester);
      }

      expect(find.byTooltip('Account menu'), findsOneWidget);
      await tester.tap(find.byTooltip('Account menu'));
      await settle(tester);
      expect(find.text('Amy Writer'), findsWidgets);
      expect(find.text('@amy · amy@example.com'), findsOneWidget);
      await tester.tapAt(const Offset(5, 400));
      await settle(tester);
      await menu('Dashboard');
      expect(find.byType(AccountScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await menu('New story');
      expect(find.byType(WriteScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);

      await tester.tap(find.bySemanticsLabel('Bloggerbytes home'));
      await settle(tester);
      expect(find.text('Publish your passions,'), findsOneWidget);

      await menu('Log out');
      expect(t.services.auth.user, isNull);
      await tester.runAsync(() => t.services.auth.login(username: 'amy', password: 'secret1'));
      await tester.pump();
      await drawer('Log out');
      expect(t.services.auth.user, isNull);
    });

    testWidgets('search palette: shortcuts, empty results, and every kind of command', (tester) async {
      final t = await pumpApp(tester, signedInAs: 'amy', name: 'Amy');
      Future<void> open() async {
        await tester.tap(find.byTooltip('Search'));
        await settle(tester);
      }

      await open();
      await tester.enterText(find.byKey(const Key('palette-search')), 'zzzz');
      await settle(tester);
      expect(find.text('No matches for "zzzz"'), findsOneWidget);
      await tester.testTextInput.receiveAction(TextInputAction.go); // nothing to run
      await settle(tester);
      await tester.enterText(find.byKey(const Key('palette-search')), 'leaderboard');
      await settle(tester);
      await tester.testTextInput.receiveAction(TextInputAction.go); // runs the first match
      await settle(tester);
      expect(find.text('The '), findsNothing);
      expect(routerOf(tester).routerDelegate.currentConfiguration.uri.path, '/rewards');

      final dark = t.services.theme.isDark(tester.element(find.byType(Scaffold).first));
      await open();
      await tester.enterText(find.byKey(const Key('palette-search')), 'toggle');
      await settle(tester);
      await tester.tap(find.text('Toggle light / dark'));
      await settle(tester);
      expect(t.services.theme.isDark(tester.element(find.byType(Scaffold).first)), !dark);

      await open();
      await tester.enterText(find.byKey(const Key('palette-search')), 'dashboard');
      await settle(tester);
      await tester.tap(find.text('My dashboard'));
      await settle(tester);
      expect(find.byType(AccountScreen), findsOneWidget);
    });
  });

  group('screens', () {
    testWidgets('home: buttons, topics, refresh, and the empty state', (tester) async {
      await pumpApp(tester, backend: FakeBackend(blogs: []));
      await tester.scrollUntilVisible(find.text('No stories yet'), 300, scrollable: find.byType(Scrollable).first);
      await pullToRefresh(tester);
      await tapIn(tester, button('Write a story'));
      expect(find.byType(LoginScreen), findsOneWidget); // signed out: the guard asks to sign in
      routerOf(tester).pop();
      await settle(tester);
      await tapIn(tester, button('Write yours now'));
      expect(find.byType(SignupScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await tapIn(tester, find.text('See all stories'));
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('home hero: start writing, explore, search, topic chips', (tester) async {
      await pumpApp(tester);
      await tester.tap(find.text('Start writing — free'));
      await settle(tester);
      expect(find.byType(SignupScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await tester.tap(find.text('Search anything'));
      await settle(tester);
      expect(find.byKey(const Key('palette-search')), findsOneWidget);
      Navigator.of(tester.element(find.byKey(const Key('palette-search')))).pop();
      await settle(tester);
      await tester.tap(find.text('Explore stories'));
      await settle(tester);
      expect(find.byType(ExploreScreen), findsOneWidget);
      routerOf(tester).go('/');
      await settle(tester);
      await tester.scrollUntilVisible(
        find.widgetWithText(ActionChip, 'Ocean'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.widgetWithText(ActionChip, 'Ocean'));
      await settle(tester);
      expect(find.text('1 story for "Ocean"'), findsOneWidget);
    });

    testWidgets('stories: more featured, errors, empty community, explore link', (tester) async {
      final extra = {...FakeBackend.featured.first, '_id': 'featured-2', 'title': 'Second featured'};
      FakeBackend.featured.add(extra);
      addTearDown(() => FakeBackend.featured.remove(extra));
      final backend = FakeBackend(blogs: []);
      await pumpApp(tester, backend: backend, location: '/blog');
      await tester.scrollUntilVisible(find.text('Second featured'), 300, scrollable: find.byType(Scrollable).first);
      await tester.scrollUntilVisible(find.text('Nothing here yet'), 300, scrollable: find.byType(Scrollable).first);
      backend.failNext['GET /blogs'] = 500;
      await pullToRefresh(tester);
      expect(find.text('Something went wrong.'), findsOneWidget);
      await tapIn(tester, button('Write the first post'));
      expect(find.byType(LoginScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await tapIn(tester, find.text('Explore everything'));
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('explore: sort menu, clearing, links that change the query, errors, empty', (tester) async {
      final backend = FakeBackend();
      await pumpApp(tester, backend: backend, location: '/cate');
      await tester.tap(find.byTooltip('Sort stories'));
      await settle(tester);
      await tester.tap(find.text('Most viewed').last);
      await settle(tester);
      expect(find.text('Most viewed'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('explore-search')), 'nothing like this');
      await settle(tester);
      await tapIn(tester, find.text('Write it'));
      expect(find.byType(LoginScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await tester.drag(find.byType(Scrollable).first, const Offset(0, 3000)); // back to the top
      await settle(tester);
      await tester.tap(find.byTooltip('Clear search'));
      await settle(tester);
      expect(find.text('3 stories'), findsOneWidget);
      routerOf(tester).go('/cate?q=Art'); // same screen, new query
      await settle(tester);
      expect(find.text('1 story for "Art"'), findsOneWidget);
      backend.failNext['GET /BAdd'] = 500;
      await pullToRefresh(tester);
      expect(find.text('Something went wrong.'), findsOneWidget);
    });

    testWidgets('leaderboard: full ranking with you highlighted, refresh, and the empty podium', (tester) async {
      final backend = FakeBackend(blogs: []);
      for (final (i, u) in ['ann', 'bob', 'cat', 'dee', 'eve'].indexed) {
        backend.addUser(u, name: u.toUpperCase());
        backend.addBlog({
          'auth': u,
          'title': 'By $u',
          'cate': 'Art',
          'img': 'img1',
          'likedBy': List.filled(5 - i, 'x'),
        });
      }
      await pumpApp(tester, backend: backend, signedInAs: 'dee', location: '/rewards');
      expect(find.text('DEE'), findsOneWidget);
      expect(find.text('@eve · 1 stories'), findsOneWidget);
      await pullToRefresh(tester);

      await pumpApp(
        tester,
        backend: FakeBackend(blogs: []),
        location: '/rewards',
      );
      expect(find.text('The podium is empty'), findsOneWidget);
      await tapIn(tester, find.text('Write now'));
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('gallery: use as cover, lightbox keys, wrap-around, close', (tester) async {
      await pumpApp(tester, signedInAs: 'amy', location: '/gallery');
      await tapIn(tester, find.byTooltip('Use 111 as cover'));
      expect(find.byType(WriteScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);

      await tapIn(tester, find.byKey(const Key('pool-111')));
      expect(find.text('111 · 1/19'), findsOneWidget);
      await tester.tap(find.byTooltip('Previous')); // wraps to the last picture
      await settle(tester);
      expect(find.text('writing-blogs · 19/19'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await settle(tester);
      expect(find.text('111 · 1/19'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await settle(tester);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await settle(tester);
      expect(find.text('111 · 1/19'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await settle(tester);
      expect(find.byTooltip('Previous'), findsNothing);
      await tapIn(tester, find.byKey(const Key('pool-111')));
      await tester.tap(find.byTooltip('Close'));
      await settle(tester);
      expect(find.byTooltip('Previous'), findsNothing);
    });

    testWidgets('reader: progress, topic links, body links, share and its fallback, errors', (tester) async {
      final backend = FakeBackend();
      final story = backend.blogs.firstWhere((b) => b['title'] == 'Ocean dreams');
      story['blogp2'] = '<p>Read <a href="https://example.com/more">more here</a>.</p>${'<p>Long text.</p>' * 40}';
      await pumpApp(tester, backend: backend, signedInAs: 'reader', location: '/post/${story['_id']}');

      await tester.drag(find.byType(CustomScrollView), const Offset(0, -600));
      await settle(tester);
      expect(tester.widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator)).value, greaterThan(0));

      await tester.ensureVisible(find.byKey(const Key('body')));
      await settle(tester);
      await tester.tapOnText(find.textRange.ofSubstring('more here'));
      await settle(tester);
      expect(launcher.launched, ['https://example.com/more']);

      await tester.drag(find.byType(CustomScrollView), const Offset(0, 2000));
      await settle(tester);
      await tester.tap(find.byTooltip('Share this story'));
      await settle(tester);
      expect(share.shared.single.text, contains('/#/post/${story['_id']}'));
      share.fail = true;
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
        return null;
      });
      await tester.tap(find.byTooltip('Share this story'));
      await settle(tester);
      expect(copied, contains('/#/post/'));
      expect(find.text('Link copied to clipboard.'), findsOneWidget);

      backend.failNext['POST /posts/${story['_id']}/like'] = 500;
      await tester.tap(find.byKey(const Key('like')));
      await settle(tester);
      expect(find.text('Something went wrong.'), findsOneWidget);

      await tester.tap(find.widgetWithText(ActionChip, 'Travel'));
      await settle(tester);
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('reader: delete failure, and the error page link', (tester) async {
      final backend = FakeBackend();
      final mine = backend.blogs.firstWhere((b) => b['title'] == 'Art of noise');
      await pumpApp(tester, backend: backend, signedInAs: 'alice', location: '/post/${mine['_id']}');
      backend.failNext['DELETE /posts/${mine['_id']}'] = 500;
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -300));
      await settle(tester);
      await tester.tap(find.byTooltip('Delete this story'));
      await settle(tester);
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await settle(tester);
      expect(find.text('Something went wrong.'), findsOneWidget);
      expect(find.byType(PostScreen), findsOneWidget);

      await pumpApp(tester, backend: backend, location: '/post/missing');
      await tester.tap(find.text('Explore other stories'));
      await settle(tester);
      expect(find.byType(ExploreScreen), findsOneWidget);
    });

    testWidgets('about: contact email and sign-up link', (tester) async {
      await pumpApp(tester, location: '/aboutme');
      await tapIn(tester, find.text('bloggerbytesinfo@gmail.com'));
      expect(launcher.launched.single, startsWith('mailto:bloggerbytesinfo@gmail.com'));
      await tapIn(tester, find.text('or start writing today'));
      expect(find.byType(SignupScreen), findsOneWidget);
    });

    testWidgets('footer: newsletter by keyboard and its error, socials, and links that fail to open', (tester) async {
      final backend = FakeBackend();
      await pumpApp(tester, backend: backend, location: '/aboutme');
      final email = find.byKey(const Key('newsletter-email'));
      await tester.scrollUntilVisible(email, 300, scrollable: find.byType(Scrollable).first);
      backend.failNext['POST /subscribe'] = 400;
      await tester.enterText(email, 'reader@example.com');
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await settle(tester);
      expect(find.text('Something went wrong.'), findsOneWidget);

      launcher.result = false; // nothing installed to open it: fails quietly
      for (final label in ['Facebook', 'X (Twitter)', 'Telegram', 'Email']) {
        await tapIn(tester, find.byTooltip(label));
      }
      expect(launcher.launched.length, 4);
    });

    testWidgets('auth screens: show/hide passwords, switch between them, submit by keyboard, sign-up errors', (
      tester,
    ) async {
      final backend = FakeBackend()..addUser('taken');
      await pumpApp(tester, backend: backend, location: '/login');
      await tester.tap(find.byTooltip('Show password'));
      await settle(tester);
      expect(find.byTooltip('Hide password'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('username')), 'taken');
      await tester.enterText(
        find.descendant(of: find.byKey(const Key('password')), matching: find.byType(TextField)),
        'secret1',
      );
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await settle(tester);
      expect(find.byType(AccountScreen), findsOneWidget);

      await pumpApp(tester, backend: backend, location: '/login');
      await tapIn(tester, find.text('Create a free account'));
      expect(find.byType(SignupScreen), findsOneWidget);
      await tester.tap(find.byTooltip('Show password'));
      await settle(tester);
      await tester.enterText(find.byKey(const Key('name')), 'Someone');
      await tester.enterText(find.byKey(const Key('username')), 'taken');
      await tester.enterText(find.byKey(const Key('email')), 'other@example.com');
      await tester.enterText(
        find.descendant(of: find.byKey(const Key('password')), matching: find.byType(TextField)),
        'secret12',
      );
      await tester.pump();
      await tapIn(tester, find.byKey(const Key('submit')));
      expect(find.text('That username is already registered.'), findsOneWidget);
      await tapIn(tester, find.widgetWithText(TextButton, 'Sign in').last);
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('dashboard: signed-out view, email link, new story and empty-tab buttons', (tester) async {
      final t = await pumpApp(
        tester,
        backend: FakeBackend(blogs: []),
        signedInAs: 'amy',
        location: '/myacc',
      );
      await tester.tap(find.text('amy@example.com'));
      await settle(tester);
      expect(launcher.launched.single, 'mailto:amy@example.com');
      await tester.tap(find.text('New story'));
      await settle(tester);
      expect(find.byType(WriteScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);
      await tapIn(tester, find.text('Write a story'));
      expect(find.byType(WriteScreen), findsOneWidget);
      routerOf(tester).pop();
      await settle(tester);

      await tester.runAsync(t.services.auth.logout);
      await tester.pump();
      expect(find.text('Please sign in first.'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
      await settle(tester);
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('studio: works without the Image Pool manifest or topic suggestions', (tester) async {
      final backend = FakeBackend();
      backend.failNext['GET /BAdd'] = 500;
      await pumpApp(tester, backend: backend, signedInAs: 'amy', location: '/writeblog', bundle: EmptyBundle());
      expect(find.byType(WriteScreen), findsOneWidget);
      expect(find.textContaining('+ '), findsNothing);
    });
  });

  test('drafts store survives bad data', () async {
    SharedPreferences.setMockInitialValues({'bb-draft': '{not json'});
    expect(DraftStore(await SharedPreferences.getInstance()).load(), isNull);
  });
}
