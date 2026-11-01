// End-to-end check of the app's API layer against the real Express backend.
//
//   cd backend && PORT=3100 npm run dev:memory     # throwaway in-memory database
//   cd mobile  && BACKEND_URL=http://localhost:3100 flutter test --tags backend
//
// Skipped when BACKEND_URL is not set. CI runs it on every push (.github/workflows/mobile.yml).
@Tags(['backend'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:bloggerbytes/src/api/api_client.dart';
import 'package:bloggerbytes/src/api/models.dart';
import 'package:bloggerbytes/src/api/posts_api.dart';
import 'package:bloggerbytes/src/state/auth.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final baseUrl = Platform.environment['BACKEND_URL'];
  final skip = baseUrl == null ? 'Set BACKEND_URL to run against a live backend' : null;

  final cookies = MemoryCookieStore();
  late ApiClient api;
  late PostsApi posts;
  late AuthController auth;
  final username = 'app_${DateTime.now().millisecondsSinceEpoch % 100000000}';
  const password = 'Sup3r-secret!';
  late String blogId;
  late String img;

  Future<Object?> failure(Future<Object?> f) => f.then<Object?>((_) => null, onError: (Object e) => e);

  setUpAll(() {
    if (baseUrl == null) return;
    api = ApiClient(baseUrl: baseUrl, cookies: cookies, manageCookies: true);
    posts = PostsApi(api);
    auth = AuthController(api);
    // The app's bundled Image Pool (read from disk: the asset bundle needs a test binding, which blocks real HTTP).
    final images = (jsonDecode(File('assets/picyourpic/manifest.json').readAsStringSync()) as List).cast<String>();
    img = images.firstWhere((i) => i.startsWith('img'));
  });

  BlogInput story({String? status, DateTime? publishAt, String title = 'Flutter contract test'}) => BlogInput(
    title: title,
    cate: 'TechByte | Travel',
    img: img,
    blogp1: 'Opening.',
    blogp2: '<h2>Day one</h2><p>The <strong>rest</strong>.</p><script>alert(1)</script>',
    status: status,
    publishAt: publishAt,
  );

  group('live backend', skip: skip, () {
    test('health and public reads', () async {
      expect(await api.get('/health'), {'status': 'ok'});
      final featured = await posts.featured();
      expect(featured, isNotEmpty);
      expect(featured.first.featured, isTrue);
      expect(featured.first.author, isNotEmpty);
      expect((await posts.get(featured.first.id)).title, featured.first.title);
      final all = await posts.all();
      expect(all, isNotEmpty); // seeded sample blogs
      expect(all.first.blogp2, startsWith('<')); // bodies are always HTML
      expect((await posts.stats()).blogs, greaterThanOrEqualTo(featured.length));
    });

    test('signed out: /myacc is null, writes need a session', () async {
      expect(await auth.load(), isNull);
      expect(await failure(posts.create(story())), isA<ApiException>().having((e) => e.status, 'status', 401));
    });

    test('sign up needs a name, stores it, and the session survives an app restart', () async {
      final err = await failure(
        auth.signup(username: username, name: ' ', email: '$username@example.com', password: password),
      );
      expect(errorMessage(err!, ''), contains('your name'));

      await auth.signup(
        username: username,
        name: 'Contract Tester',
        email: '$username@example.com',
        password: password,
      );
      expect(auth.user?.displayName, 'Contract Tester');
      expect(cookies.read(), isNotNull);
      final relaunched = AuthController(ApiClient(baseUrl: baseUrl!, cookies: cookies, manageCookies: true));
      expect((await relaunched.load())?.email, '$username@example.com');

      await auth.rename('Contract Writer');
      expect(auth.user?.name, 'Contract Writer');
    });

    test('duplicate sign up is rejected with a readable message', () async {
      final other = AuthController(ApiClient(baseUrl: baseUrl!, manageCookies: true));
      final err = await failure(
        other.signup(username: username, name: 'X', email: 'x$username@example.com', password: password),
      );
      expect(errorMessage(err!, ''), 'That username is already registered.');
    });

    test('publish: validates the Image Pool name, sanitizes the body, shows the display name', () async {
      final bad = await failure(
        posts.create(BlogInput(title: 'x', cate: 'x', img: 'not-a-picture', blogp1: 'x', blogp2: '<p>x</p>')),
      );
      expect(errorMessage(bad!, ''), contains('Image Pool'));

      final created = await posts.create(story());
      blogId = created.id;
      expect(created.auth, username); // from the session, not the request
      expect(created.author, 'Contract Writer');
      expect(created.status, BlogStatus.published);
      expect(created.blogp2, '<h2>Day one</h2><p>The <strong>rest</strong>.</p>');
      expect((await posts.all()).map((b) => b.id), contains(blogId));
      expect((await auth.load())!.blogs.map((b) => b.id), contains(blogId));
    });

    test('drafts stay private; scheduled stories wait; both can be edited and published', () async {
      final draft = await posts.create(const BlogInput(title: 'Half an idea', status: 'draft'));
      expect(draft.status, BlogStatus.draft);
      final scheduled = await posts.create(
        story(publishAt: DateTime.now().add(const Duration(days: 2)), title: 'Later'),
      );
      expect(scheduled.status, BlogStatus.scheduled);
      final public = (await posts.all()).map((b) => b.id);
      expect(public, isNot(contains(draft.id)));
      expect(public, isNot(contains(scheduled.id)));
      expect((await auth.load())!.blogs.map((b) => b.status), containsAll([BlogStatus.draft, BlogStatus.scheduled]));

      final incomplete = await failure(posts.update(draft.id, const BlogInput(status: 'published')));
      expect(errorMessage(incomplete!, ''), startsWith('Missing fields'));
      final finished = await posts.update(draft.id, story(status: 'published', title: 'Finished draft'));
      expect(finished.status, BlogStatus.published);
      final now = await posts.update(scheduled.id, const BlogInput(publishNow: true));
      expect(now.status, BlogStatus.published);
      await posts.remove(draft.id);
      await posts.remove(scheduled.id);
    });

    test('opening counts a view; likes toggle; leaderboard ranks the writer by name', () async {
      final first = await posts.get(blogId);
      final second = await posts.get(blogId);
      expect(second.views, first.views + 1);

      expect(await posts.like(blogId), (likes: 1, liked: true));
      expect((await posts.get(blogId)).liked, isTrue);
      expect(await posts.like(blogId), (likes: 0, liked: false));

      final board = await posts.leaderboard();
      expect(board.firstWhere((l) => l.username == username).displayName, 'Contract Writer');
      expect(board.first.rank, 1);
    });

    test('newsletter subscribe', () async {
      await posts.subscribe('$username@example.com');
      await expectLater(posts.subscribe('nope'), throwsA(isA<ApiException>()));
    });

    test('log out clears the session; sign back in and delete', () async {
      await auth.logout();
      expect(auth.user, isNull);
      expect(cookies.read(), isNull);
      final err = await failure(posts.like(blogId));
      expect(errorMessage(err!, ''), 'Please sign in first.');

      await expectLater(auth.login(username: username, password: 'wrong-password'), throwsA(isA<ApiException>()));
      await auth.login(username: username, password: password);
      expect(auth.user?.username, username);

      await posts.remove(blogId);
      await expectLater(posts.get(blogId), throwsA(isA<ApiException>().having((e) => e.status, 'status', 404)));
      await auth.logout();
    });
  });
}
