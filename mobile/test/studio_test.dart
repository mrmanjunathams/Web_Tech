import 'package:bloggerbytes/src/rich_text.dart';
import 'package:bloggerbytes/src/ui/screens/account.dart';
import 'package:bloggerbytes/src/ui/screens/login.dart';
import 'package:bloggerbytes/src/ui/screens/post.dart';
import 'package:bloggerbytes/src/ui/screens/write.dart';
import 'package:bloggerbytes/src/ui/widgets/rich_editor.dart';
import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'support/fake_backend.dart';
import 'support/harness.dart';

/// Types [text] into the story body (the Quill editor) as plain paragraphs.
Future<void> typeBody(WidgetTester tester, String text) async {
  final editor = tester.state<RichEditorState>(find.byType(RichEditor));
  editor.controller.replaceText(0, editor.controller.document.length - 1, text, null);
  await tester.pump();
}

Future<void> fillStory(WidgetTester tester, {String title = 'My trip', String opening = 'It began.'}) async {
  await tester.enterText(find.byKey(const Key('title')), title);
  await tester.enterText(find.byKey(const Key('blogp1')), opening);
  await typeBody(tester, 'And ended.');
}

Future<void> menu(WidgetTester tester, String item) async {
  await tester.tap(find.byKey(const Key('studio-menu')));
  await settle(tester);
  await tester.tap(find.text(item));
  await settle(tester);
}

String bodyText(WidgetTester tester) =>
    tester.state<RichEditorState>(find.byType(RichEditor)).controller.document.toPlainText().trim();

/// Opens the studio on top of the home tab, so "back" has somewhere to go.
Future<void> openStudio(WidgetTester tester, [String query = '']) async {
  GoRouter.of(tester.element(find.byType(Scaffold).first)).push('/writeblog$query');
  await settle(tester);
}

/// Brings the widget with [key] or [text] into view on the screen of type [T] (building it first if needed).
Future<void> scrollIn<T>(WidgetTester tester, {Key? key, String? text}) async {
  Finder target({bool skipOffstage = true}) =>
      key != null ? find.byKey(key, skipOffstage: skipOffstage) : find.text(text!, skipOffstage: skipOffstage);
  final list = find.descendant(of: find.byType(T), matching: find.byType(Scrollable)).first;
  for (var i = 0; i < 30 && target(skipOffstage: false).evaluate().isEmpty; i++) {
    await tester.drag(list, const Offset(0, -300));
    await tester.pump();
  }
  await tester.runAsync(() => Scrollable.ensureVisible(target(skipOffstage: false).evaluate().first));
  await settle(tester);
}

String status(WidgetTester tester) => tester.widget<Text>(find.byKey(const Key('status'))).data!;
String saveState(WidgetTester tester) => tester.widget<Text>(find.byKey(const Key('save-state'))).data!;

void main() {
  testWidgets('new story: cover, topics, body, preview, then publish now', (tester) async {
    final app = await pumpApp(tester, signedInAs: 'writer', name: 'Wendy Writer', location: '/writeblog?img=img7');
    expect(status(tester), 'New story');
    expect(find.text('By Wendy Writer'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byKey(const Key('publish'))).onPressed, isNull);

    // Cover: remove, then choose from the sheet.
    await tester.tap(find.byTooltip('Remove cover'));
    await settle(tester);
    await tester.tap(find.byKey(const Key('add-cover')));
    await settle(tester);
    await tester.tap(find.byKey(const Key('cover-img2')));
    await settle(tester);
    await tester.tap(find.text('Change'));
    await settle(tester);
    await tester.tapAt(const Offset(20, 20)); // dismiss without choosing
    await settle(tester);

    await fillStory(tester);
    expect(saveState(tester), contains('4 words'));

    // Topics: typed (with "|" folded into a space), suggestions, removal.
    await scrollIn<WriteScreen>(tester, key: const Key('topic'));
    await tester.enterText(find.byKey(const Key('topic')), 'Food | Drink');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await settle(tester);
    await tester.enterText(find.byKey(const Key('topic')), 'food drink');
    await tester.tap(find.byTooltip('Add topic')); // duplicate: ignored
    await settle(tester);
    await tester.tap(find.text('+ Travel'));
    await settle(tester);
    expect(find.widgetWithText(InputChip, 'Food Drink'), findsOneWidget);
    await tester.tap(find.byTooltip('Remove Food Drink'));
    await settle(tester);

    // Preview shows the story as readers will.
    await tester.tap(find.byTooltip('Preview'));
    await settle(tester);
    expect(find.byKey(const Key('preview-title')), findsOneWidget);
    expect(find.textContaining('And ended.', findRichText: true), findsWidgets);
    await tester.tap(find.byTooltip('Edit'));
    await settle(tester);

    await tester.tap(find.byKey(const Key('publish')));
    await settle(tester);
    expect(find.byType(PostScreen), findsOneWidget);
    expect(find.text('Your story is live!'), findsOneWidget);
    final created = app.backend.blogs.first;
    expect(
      (created['auth'], created['img'], created['cate'], created['status']),
      ('writer', 'img2', 'Travel', 'published'),
    );
    expect(created['blogp2'], '<p>And ended.</p>');
    expect(app.services.drafts.load(), isNull);
  });

  testWidgets('unsaved new stories are kept on the device, restored, and can be cleared', (tester) async {
    final app = await pumpApp(
      tester,
      signedInAs: 'writer',
      prefs: {'bb-draft': '{"title":"Saved idea","blogp2":"<p>body</p>"}'},
    );
    await openStudio(tester);
    expect(find.text('Saved idea'), findsOneWidget);
    expect(bodyText(tester), 'body'); // restored into the editor

    await tester.enterText(find.byKey(const Key('title')), 'Better idea');
    await tester.pump();
    expect(saveState(tester), startsWith('Editing…'));
    await tester.pump(autosaveDelay);
    await settle(tester);
    expect(app.services.drafts.load()!.title, 'Better idea');
    expect(saveState(tester), startsWith('Saved on this device'));

    // Clear (after confirming).
    await menu(tester, 'Clear draft');
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    expect(find.text('Better idea'), findsOneWidget);
    await menu(tester, 'Clear draft');
    await tester.tap(find.widgetWithText(FilledButton, 'Clear'));
    await settle(tester);
    expect(app.services.drafts.load(), isNull);
    expect(find.text('Better idea'), findsNothing);
    expect(bodyText(tester), ''); // editor emptied too

    // Nothing worth keeping isn't stored; leaving keeps typed text.
    await tester.tap(find.byKey(const Key('add-cover')));
    await settle(tester);
    await tester.tap(find.byKey(const Key('cover-img1')));
    await tester.pump(autosaveDelay);
    await settle(tester);
    expect(app.services.drafts.load(), isNull);
    await tester.enterText(find.byKey(const Key('title')), 'Leaving now');
    await tester.pageBack();
    await settle(tester);
    expect(app.services.drafts.load()!.title, 'Leaving now');
  });

  testWidgets('drafts: save to the server, autosave, flush on leaving, then publish', (tester) async {
    final app = await pumpApp(tester, signedInAs: 'writer', location: '/');
    await tester.tap(find.byType(FloatingActionButton));
    await settle(tester);
    await tester.enterText(find.byKey(const Key('title')), 'Draft one');
    await menu(tester, 'Save draft');
    expect(find.text('Draft saved. Finish it whenever you like.'), findsOneWidget);
    expect(status(tester), 'Draft');
    final id = app.backend.blogs.first['_id'];
    expect(app.backend.blogs.first['status'], 'draft');

    // Saving again with no changes sends nothing.
    final before = app.backend.requests.length;
    await menu(tester, 'Save draft');
    expect(app.backend.requests.length, before);

    // Edits autosave quietly.
    await tester.enterText(find.byKey(const Key('blogp1')), 'More words');
    await tester.pump(autosaveDelay);
    await settle(tester);
    expect(app.backend.blogs.first['blogp1'], 'More words');
    expect(saveState(tester), startsWith('Saved'));

    // Leaving with pending edits saves them first.
    await tester.enterText(find.byKey(const Key('title')), 'Draft one, renamed');
    await tester.pageBack();
    await settle(tester);
    expect(app.backend.blogs.first['title'], 'Draft one, renamed');
    expect(find.byType(WriteScreen), findsNothing);

    // Reopen it from the dashboard and publish.
    GoRouter.of(tester.element(find.byType(Scaffold).first)).push('/myacc');
    await settle(tester);
    await scrollIn<AccountScreen>(tester, key: const Key('tab-draft'));
    await tester.tap(find.byKey(const Key('tab-draft')));
    await settle(tester);
    await tester.tap(find.text('Draft one, renamed'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsOneWidget);
    await typeBody(tester, 'Body text');
    await tester.scrollUntilVisible(
      find.byKey(const Key('add-cover')),
      -300,
      scrollable: find.descendant(of: find.byType(WriteScreen), matching: find.byType(Scrollable)).first,
    );
    await tester.tap(find.byKey(const Key('add-cover')));
    await settle(tester);
    await tester.tap(find.byKey(const Key('cover-img3')));
    await settle(tester);
    await scrollIn<WriteScreen>(tester, key: const Key('topic'));
    await tester.enterText(find.byKey(const Key('topic')), 'Art');
    await tester.tap(find.byTooltip('Add topic'));
    await settle(tester);
    await tester.tap(find.byKey(const Key('publish')));
    await settle(tester);
    expect(find.byType(PostScreen), findsOneWidget);
    expect(app.backend.blogs.firstWhere((b) => b['_id'] == id)['status'], 'published');
  });

  testWidgets('schedule a story for later with the date and time pickers', (tester) async {
    final app = await pumpApp(tester, signedInAs: 'writer', location: '/writeblog?img=img1');
    await fillStory(tester);
    await scrollIn<WriteScreen>(tester, key: const Key('topic'));
    await tester.enterText(find.byKey(const Key('topic')), 'Travel');
    await tester.tap(find.byTooltip('Add topic'));
    await settle(tester);

    // Cancelling the date picker does nothing.
    await menu(tester, 'Schedule…');
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    // Cancelling the time picker does nothing either.
    await menu(tester, 'Schedule…');
    await tester.tap(find.text('OK'));
    await settle(tester);
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    expect(app.backend.blogs.first['title'], isNot('My trip'));

    // Tomorrow at the suggested time.
    await menu(tester, 'Schedule…');
    await tester.tap(find.text('OK'));
    await settle(tester);
    await tester.tap(find.text('OK'));
    await settle(tester);
    expect(find.byType(AccountScreen), findsOneWidget);
    expect(find.textContaining('Scheduled for'), findsOneWidget);
    final b = app.backend.blogs.first;
    expect(b['status'], 'published');
    expect(DateTime.parse(b['publishAt'] as String).isAfter(DateTime.now()), isTrue);
  });

  testWidgets('a time already past is rejected', (tester) async {
    await pumpApp(tester, signedInAs: 'writer', location: '/writeblog?img=img1');
    await fillStory(tester);
    await scrollIn<WriteScreen>(tester, key: const Key('topic'));
    await tester.enterText(find.byKey(const Key('topic')), 'Travel');
    await tester.tap(find.byTooltip('Add topic'));
    await settle(tester);
    await menu(tester, 'Schedule…');
    // Today, then a time in the past (midnight).
    final today = DateTime.now().day;
    await tester.tap(find.text('$today').last);
    await tester.tap(find.text('OK'));
    await settle(tester);
    await tester.tap(find.byIcon(Icons.keyboard_outlined));
    await settle(tester);
    final fields = find.byType(TextFormField);
    await tester.enterText(fields.at(0), '12'); // 12:00 AM = midnight, already past
    await tester.enterText(fields.at(1), '00');
    await tester.tap(find.text('AM'));
    await tester.tap(find.text('OK'));
    await settle(tester);
    await scrollIn<WriteScreen>(tester, text: 'Pick a time in the future to schedule your story.');
  });

  testWidgets('editing a scheduled story: reschedule menu, update, move to drafts, delete', (tester) async {
    final backend = FakeBackend();
    backend.addUser('writer', name: 'Wendy');
    backend.addBlog({
      'auth': 'writer',
      'title': 'Soon',
      'cate': 'Art',
      'img': 'img2',
      'publishAt': DateTime.now().add(const Duration(days: 3)).toUtc().toIso8601String(),
    });
    final id = backend.blogs.first['_id'];
    final app = await pumpApp(tester, backend: backend, signedInAs: 'writer');
    await openStudio(tester, '?id=$id');
    expect(status(tester), startsWith('Scheduled · '));
    expect(find.byKey(const Key('update')), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byKey(const Key('update'))).onPressed, isNull); // nothing changed
    await tester.tap(find.byKey(const Key('studio-menu')));
    await settle(tester);
    expect(find.text('Reschedule…'), findsOneWidget);
    expect(find.text('Save draft'), findsNothing);
    await tester.tapAt(const Offset(10, 10));
    await settle(tester);

    // Unsaved edits: leaving asks; staying keeps them.
    await tester.enterText(find.byKey(const Key('title')), 'Soon, better');
    await tester.pump();
    expect(saveState(tester), startsWith('Unsaved changes'));
    await tester.pageBack();
    await settle(tester);
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsOneWidget);

    await tester.tap(find.byKey(const Key('update')));
    await settle(tester);
    expect(find.text('Changes saved.'), findsOneWidget);
    expect(backend.blogs.first['title'], 'Soon, better');

    // A failing update shows the API's error.
    await tester.enterText(find.byKey(const Key('title')), 'Third');
    backend.failNext['PATCH /posts/$id'] = 500;
    await tester.state<WriteScreenState>(find.byType(WriteScreen)).update(); // (the button itself is tapped above)
    await settle(tester);
    await scrollIn<WriteScreen>(tester, text: 'Something went wrong.');

    // Move to drafts.
    await menu(tester, 'Move to drafts');
    await tester.tap(find.text('Cancel'));
    await settle(tester);
    await menu(tester, 'Move to drafts');
    await tester.tap(find.widgetWithText(FilledButton, 'Move to drafts'));
    await settle(tester);
    expect(status(tester), 'Draft');

    // Delete: a failure first, then for real.
    backend.failNext['DELETE /posts/$id'] = 500;
    await menu(tester, 'Delete story');
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await settle(tester);
    expect(find.text('Something went wrong.'), findsWidgets);
    await menu(tester, 'Delete story');
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await settle(tester);
    expect(find.byType(AccountScreen), findsOneWidget);
    expect(backend.blogs.where((b) => b['_id'] == id), isEmpty);
    expect(app.services.auth.user!.blogs, isEmpty);
  });

  testWidgets('leaving a live story with unsaved edits, confirmed', (tester) async {
    final backend = FakeBackend();
    final mine = backend.blogs.firstWhere((b) => b['title'] == 'Art of noise');
    await pumpApp(tester, backend: backend, signedInAs: 'alice', location: '/');
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.byType(Scaffold).first)).push('/writeblog?id=${mine['_id']}');
    await settle(tester);
    expect(status(tester), 'Published');
    expect(find.textContaining('01-NOV-2026'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('title')), '');
    await tester.pageBack();
    await settle(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Leave'));
    await settle(tester);
    expect(find.byType(WriteScreen), findsNothing);
  });

  testWidgets("someone else's story can't be edited", (tester) async {
    final backend = FakeBackend();
    final theirs = backend.blogs.firstWhere((b) => b['auth'] == 'bob');
    await pumpApp(tester, backend: backend, signedInAs: 'alice', location: '/writeblog?id=${theirs['_id']}');
    expect(find.text("That story can't be edited."), findsOneWidget);
    expect(find.byType(AccountScreen), findsOneWidget);
  });

  testWidgets('a session that ended while saving keeps the draft and asks to sign in', (tester) async {
    final app = await pumpApp(tester, signedInAs: 'writer', location: '/writeblog');
    await tester.enterText(find.byKey(const Key('title')), 'Precious words');
    app.backend.failNext['POST /addblog'] = 401;
    await menu(tester, 'Save draft');
    expect(find.text('Your session ended. Sign in again; your draft is kept on this device.'), findsOneWidget);
    expect(app.services.drafts.load()!.title, 'Precious words');
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('with no session at all the byline falls back to "you"', (tester) async {
    final app = await pumpApp(tester, signedInAs: 'writer', location: '/writeblog');
    await tester.runAsync(app.services.auth.logout);
    await tester.pump();
    await tester.enterText(find.byKey(const Key('title')), 'x');
    await tester.pump();
    expect(find.text('By you'), findsOneWidget);
  });

  test('rich text conversion', () {
    expect(documentToHtml(Document()), '');
    expect(documentFromHtml('').toPlainText(), '\n');
    final doc = documentFromHtml(
      '<h2>Title</h2><p>Some <strong>bold</strong> and <a href="https://x.example">a link</a>.</p>',
    );
    expect(doc.toPlainText(), 'Title\nSome bold and a link.\n');
    final html = documentToHtml(doc);
    expect(html, contains('<strong>bold</strong>'));
    expect(html, contains('href="https://x.example"'));
    expect(
      textOf('<p>a&amp;b &lt;c&gt; &quot;d&quot; &#39;e&#39;&nbsp;f</p><ul><li>g</li></ul>'),
      'a&b <c> "d" \'e\' f\ng\n',
    );
    expect(toggleTopic('Art', 'art'), '');
  });
}
