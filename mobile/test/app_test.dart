import 'package:bloggerbytes/src/ui/screens/account.dart';
import 'package:bloggerbytes/src/ui/screens/login.dart';
import 'package:bloggerbytes/src/ui/screens/post.dart';
import 'package:bloggerbytes/src/ui/screens/write.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_backend.dart';
import 'support/harness.dart';

void main() {
  testWidgets('home shows live stats, trending stories and the newsletter', (tester) async {
    final app = await pumpApp(tester);

    expect(find.textContaining('stories and counting'), findsOneWidget);
    expect(find.text('Publish your passions,'), findsOneWidget);
    expect(find.text('Start writing — free'), findsOneWidget);
    // Trending = most liked first.
    await tester.scrollUntilVisible(find.text('Ocean dreams'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Ocean dreams'), findsOneWidget);

    final email = find.byKey(const Key('newsletter-email'));
    await tester.scrollUntilVisible(email, 400, scrollable: find.byType(Scrollable).first);
    await tester.enterText(email, 'Reader@Example.com');
    await tester.pump();
    await tester.tap(find.text('Subscribe'));
    await settle(tester);
    expect(app.backend.subscribers, {'reader@example.com'});
    expect(find.textContaining("You're in."), findsOneWidget);
  });

  testWidgets('bottom navigation reaches every section', (tester) async {
    await pumpApp(tester);
    final nav = find.byType(NavigationBar);

    await tester.tap(find.descendant(of: nav, matching: find.text('Stories')));
    await settle(tester);
    expect(find.text('Featured: The quiet art of travel'), findsOneWidget);

    await tester.tap(find.descendant(of: nav, matching: find.text('Explore')));
    await settle(tester);
    expect(find.text('3 stories'), findsOneWidget);

    await tester.tap(find.descendant(of: nav, matching: find.text('Leaderboard')));
    await settle(tester);
    expect(find.byIcon(Icons.emoji_events), findsNWidgets(2)); // podium: alice, bob
    expect(find.text('alice'), findsWidgets);

    await tester.tap(find.descendant(of: nav, matching: find.text('Image Pool')));
    await settle(tester);
    expect(find.textContaining('19 photographs'), findsOneWidget);
  });

  testWidgets('explore filters by topic chip, search text and ?q= links', (tester) async {
    await pumpApp(tester, location: '/cate?q=Office');
    expect(find.text('1 story for "Office"'), findsOneWidget);
    expect(find.text('Office life'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'All'));
    await settle(tester);
    expect(find.text('3 stories'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilterChip, 'Art  1'));
    await settle(tester);
    expect(find.text('1 story for "Art"'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('explore-search')), 'nothing-matches');
    await settle(tester);
    expect(find.text('No stories match "nothing-matches"'), findsOneWidget);
  });

  testWidgets('signed-out users are sent to sign in for protected pages', (tester) async {
    await pumpApp(tester, location: '/writeblog');
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(WriteScreen), findsNothing);
  });

  testWidgets('sign in, open the dashboard, log out', (tester) async {
    final backend = FakeBackend()..addUser('alice', password: 'hunter22', name: 'Alice Liddell');
    final app = await pumpApp(tester, backend: backend, location: '/login');

    await tester.enterText(find.byKey(const Key('username')), 'alice');
    await tester.enterText(
      find.descendant(of: find.byKey(const Key('password')), matching: find.byType(TextField)),
      'wrong!!',
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('submit')));
    await settle(tester);
    expect(find.text('Invalid username or password.'), findsOneWidget);

    await tester.enterText(
      find.descendant(of: find.byKey(const Key('password')), matching: find.byType(TextField)),
      'hunter22',
    );
    await tester.pump();
    await tester.tap(find.byKey(const Key('submit')));
    await settle(tester);

    expect(find.byType(AccountScreen), findsOneWidget);
    expect(find.text('Welcome back, Alice Liddell!'), findsOneWidget);
    expect(find.text('Alice Liddell'), findsWidgets); // display name, not the username
    await tester.scrollUntilVisible(find.text('Your stories'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Your stories'), findsOneWidget);
    expect(app.cookies.read(), isNotNull);

    await tester.tap(find.byKey(const Key('logout')));
    await settle(tester);
    expect(app.services.auth.user, isNull);
    expect(app.cookies.read(), isNull);
    expect(find.text('Signed out. See you soon!'), findsOneWidget);
    expect(find.text('Start writing — free'), findsOneWidget);
  });

  testWidgets('sign up validates input and shows password strength', (tester) async {
    final app = await pumpApp(tester, location: '/signup');
    final submit = find.byKey(const Key('submit'));
    final password = find.descendant(of: find.byKey(const Key('password')), matching: find.byType(TextField));

    await tester.enterText(find.byKey(const Key('username')), 'x');
    await tester.pump();
    expect(find.text('3–30 characters: letters, numbers, . _ -'), findsOneWidget);
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);

    await tester.enterText(find.byKey(const Key('name')), '   ');
    await tester.pump();
    expect(find.text('Please enter your name (up to 60 characters).'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('name')), 'New Writer');
    await tester.enterText(find.byKey(const Key('username')), 'newbie');
    await tester.enterText(find.byKey(const Key('email')), 'new@example.com');
    await tester.enterText(password, 'Abcdefgh1!');
    await tester.pump();
    expect(find.text('Excellent'), findsOneWidget);

    await tester.tap(submit);
    await settle(tester);
    expect(app.backend.users['newbie']!.name, 'New Writer');
    expect(find.byType(AccountScreen), findsOneWidget);
    expect(find.text('Welcome to Bloggerbytes, New Writer!'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Nothing published yet'), 300, scrollable: find.byType(Scrollable).first);
  });

  testWidgets('reader: like toggles, author can delete', (tester) async {
    final backend = FakeBackend();
    final mine = backend.blogs.firstWhere((b) => b['title'] == 'Art of noise');
    final app = await pumpApp(tester, backend: backend, signedInAs: 'alice', location: '/post/${mine['_id']}');

    expect(find.text('Art of noise'), findsWidgets);
    expect(find.byTooltip('Delete this story'), findsOneWidget);

    await tester.tap(find.byKey(const Key('like')));
    await settle(tester);
    expect(mine['likedBy'], contains('alice'));
    expect(find.bySemanticsLabel('2 likes'), findsOneWidget);

    await tester.tap(find.byTooltip('Delete this story'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await settle(tester);
    expect(backend.blogs.where((b) => b['_id'] == mine['_id']), isEmpty);
    expect(find.byType(AccountScreen), findsOneWidget);
    expect(find.text('Story deleted.'), findsOneWidget);
    expect(app.services.auth.user!.blogs.map((b) => b.title), ['Ocean dreams']);
  });

  testWidgets("other people's stories can't be deleted; signed-out likes ask to sign in", (tester) async {
    final backend = FakeBackend();
    final theirs = backend.blogs.firstWhere((b) => b['auth'] == 'bob');
    await pumpApp(tester, backend: backend, location: '/post/${theirs['_id']}');

    expect(find.byTooltip('Delete this story'), findsNothing);
    await tester.tap(find.byKey(const Key('like')));
    await settle(tester);
    expect(find.text('Sign in to like stories.'), findsOneWidget);
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('missing story shows an error', (tester) async {
    await pumpApp(tester, location: '/post/does-not-exist');
    expect(find.text('Blog not found.'), findsOneWidget);
  });

  testWidgets('search palette finds pages and stories', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byTooltip('Search'));
    await settle(tester);
    expect(find.text('PAGES'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('palette-search')), 'office');
    await settle(tester);
    await tester.tap(find.text('Office life'));
    await settle(tester);
    expect(find.byType(PostScreen), findsOneWidget);
  });

  testWidgets('theme toggle switches and persists', (tester) async {
    final app = await pumpApp(tester, prefs: {'bb-theme': 'dark'});
    expect(Theme.of(tester.element(find.byType(NavigationBar))).brightness, Brightness.dark);
    await tester.tap(find.byTooltip('Switch to light theme'));
    await settle(tester);
    expect(Theme.of(tester.element(find.byType(NavigationBar))).brightness, Brightness.light);
    expect(app.services.theme.mode, ThemeMode.light);
  });

  testWidgets('image pool lightbox pages and starts a story', (tester) async {
    await pumpApp(tester, signedInAs: 'writer', location: '/gallery');
    await scrollAndTap(tester, find.byKey(const Key('pool-img1')));
    expect(find.text('img1 · 3/19'), findsOneWidget);
    await tester.tap(find.byTooltip('Next'));
    await settle(tester);
    expect(find.text('img2 · 4/19'), findsOneWidget);

    await tester.tap(find.text('Write with this'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsOneWidget);
    expect(tester.widget<WriteScreen>(find.byType(WriteScreen)).initialImage, 'img2');
  });
}
