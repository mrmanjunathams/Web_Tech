import 'package:bloggerbytes/src/ui/screens/account.dart';
import 'package:bloggerbytes/src/ui/screens/post.dart';
import 'package:bloggerbytes/src/ui/screens/write.dart';
import 'package:bloggerbytes/src/ui/widgets/feedback.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/fake_backend.dart';
import 'support/harness.dart';

Future<void> reveal(WidgetTester tester, Finder finder) async {
  scaffoldMessengerKey.currentState?.clearSnackBars();
  final list = find.descendant(of: find.byType(AccountScreen), matching: find.byType(Scrollable)).first;
  for (var i = 0; i < 20 && finder.evaluate().isEmpty; i++) {
    await tester.drag(list, const Offset(0, -300));
    await tester.pump();
  }
  await tester.ensureVisible(finder);
  await settle(tester);
}

FakeBackend withStories() {
  final backend = FakeBackend(blogs: [])..addUser('amy');
  backend.addBlog({
    'auth': 'amy',
    'title': 'Live one',
    'cate': 'Art',
    'img': 'img1',
    'likedBy': ['x'],
    'views': 7,
  });
  backend.addBlog({
    'auth': 'amy',
    'title': 'Soon',
    'cate': 'Art',
    'img': 'img2',
    'publishAt': DateTime.now().add(const Duration(days: 2)).toUtc().toIso8601String(),
  });
  backend.addBlog({
    'auth': 'amy',
    'title': '',
    'cate': '',
    'img': '',
    'status': 'draft',
    'blogp1': 'An idea',
    'date': '',
  });
  return backend;
}

void main() {
  testWidgets('accounts without a name are prompted, and can add one', (tester) async {
    final app = await pumpApp(tester, backend: withStories(), signedInAs: 'amy', location: '/myacc');
    expect(find.byKey(const Key('name-banner')), findsOneWidget);
    expect(find.byKey(const Key('profile-name')), findsOneWidget);
    expect(find.text('amy'), findsWidgets); // falls back to the username

    // Cancel, then an empty name, then a real one.
    await tester.tap(find.text('Add name'));
    await settle(tester);
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    await tester.tap(find.byKey(const Key('edit-name')));
    await settle(tester);
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(app.backend.users['amy']!.name, '');

    app.backend.failNext['PATCH /myacc'] = 500;
    await tester.tap(find.byKey(const Key('edit-name')));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('name-input')), 'Amy');
    await tester.tap(find.text('Save'));
    await settle(tester);
    expect(find.text('Something went wrong.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('edit-name')));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('name-input')), '  Amy Writer ');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await settle(tester);
    expect(app.backend.users['amy']!.name, 'Amy Writer');
    expect(find.text('Name updated.'), findsOneWidget);
    expect(find.byKey(const Key('name-banner')), findsNothing);
    expect(app.services.auth.user!.displayName, 'Amy Writer');
  });

  testWidgets('tabs show published, scheduled and draft stories with edit and delete', (tester) async {
    final backend = withStories();
    final app = await pumpApp(tester, backend: backend, signedInAs: 'amy', location: '/myacc');
    await reveal(tester, find.byKey(const Key('tab-published')));
    expect(find.text('Published  1'), findsOneWidget);
    expect(find.text('Scheduled  1', skipOffstage: false), findsOneWidget);
    expect(find.text('Drafts  1', skipOffstage: false), findsOneWidget);
    expect(find.text('Live one'), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('tab-scheduled'), skipOffstage: false));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tab-scheduled')));
    await settle(tester);
    await reveal(tester, find.textContaining('Goes live'));
    await tester.ensureVisible(find.byKey(const Key('tab-draft'), skipOffstage: false));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tab-draft')));
    await settle(tester);
    await reveal(tester, find.text('Untitled draft'));

    // Drafts open in the studio, by tapping the card or its edit button.
    await tester.tap(find.text('Untitled draft'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsOneWidget);
    GoRouter.of(tester.element(find.byType(WriteScreen))).pop();
    await settle(tester);
    await tester.tap(find.byTooltip('Edit draft'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsOneWidget);
    GoRouter.of(tester.element(find.byType(WriteScreen))).pop();
    await settle(tester);

    // Delete: cancelled, failing, then done.
    await tester.tap(find.byTooltip('Delete draft'));
    await settle(tester);
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    final id = backend.blogs.firstWhere((b) => b['status'] == 'draft')['_id'];
    backend.failNext['DELETE /posts/$id'] = 500;
    await tester.tap(find.byTooltip('Delete draft'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await settle(tester);
    expect(find.text('Something went wrong.'), findsOneWidget);
    await tester.tap(find.byTooltip('Delete draft'));
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await settle(tester);
    expect(find.text('Story deleted.'), findsOneWidget);
    await reveal(tester, find.text('No drafts'));
    expect(app.services.auth.user!.blogs.length, 2);

    // Live stories open in the reader.
    await tester.ensureVisible(find.byKey(const Key('tab-published'), skipOffstage: false));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tab-published')));
    await settle(tester);
    await reveal(tester, find.text('Live one'));
    await tester.tap(find.text('Live one'));
    await settle(tester);
    expect(find.byType(PostScreen), findsOneWidget);
  });

  testWidgets('opens on drafts when nothing is published yet', (tester) async {
    final backend = FakeBackend(blogs: [])..addUser('amy', name: 'Amy');
    backend.addBlog({'auth': 'amy', 'title': 'Only a draft', 'status': 'draft'});
    await pumpApp(tester, backend: backend, signedInAs: 'amy', location: '/myacc');
    await reveal(tester, find.text('Only a draft'));
    expect(find.text('Drafts  1', skipOffstage: false), findsOneWidget);
  });

  testWidgets('the reader shows the author their draft or scheduled story, with an edit button', (tester) async {
    final backend = withStories();
    final draft = backend.blogs.firstWhere((b) => b['status'] == 'draft');
    await pumpApp(tester, backend: backend, signedInAs: 'amy', location: '/post/${draft['_id']}');
    expect(find.text('This is a draft. Only you can see it.'), findsOneWidget);
    expect(find.text('Untitled draft'), findsOneWidget);
    expect(find.textContaining('Not published yet'), findsOneWidget);
    expect(find.byKey(const Key('like')), findsNothing);
    expect(find.byTooltip('Share this story'), findsNothing);
    await tester.tap(find.byTooltip('Edit this story'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsOneWidget);
  });

  testWidgets('scheduled notice, and others cannot see drafts', (tester) async {
    final backend = withStories();
    final soon = backend.blogs.firstWhere((b) => b['title'] == 'Soon');
    await pumpApp(tester, backend: backend, signedInAs: 'amy', location: '/post/${soon['_id']}');
    expect(find.textContaining('Scheduled for'), findsOneWidget);
    final draft = backend.blogs.firstWhere((b) => b['status'] == 'draft');
    await pumpApp(tester, backend: backend, location: '/post/${draft['_id']}');
    expect(find.text('Blog not found.'), findsOneWidget);
  });
}
