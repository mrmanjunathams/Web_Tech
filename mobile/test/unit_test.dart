import 'dart:convert';

import 'package:bloggerbytes/src/api/api_client.dart';
import 'package:bloggerbytes/src/api/models.dart';
import 'package:bloggerbytes/src/ui/screens/explore.dart';
import 'package:bloggerbytes/src/ui/screens/post.dart';
import 'package:bloggerbytes/src/ui/screens/write.dart';
import 'package:bloggerbytes/src/utils.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

BlogPost blog(
  String id, {
  String cate = 'Travel',
  String title = 'T',
  int likes = 0,
  int views = 0,
  String auth = 'a',
}) => BlogPost(
  id: id,
  auth: auth,
  title: title,
  cate: cate,
  date: '01-NOV-2026',
  img: 'img1',
  blogp1: 'x',
  blogp2: 'y',
  likes: likes,
  views: views,
);

void main() {
  group('helpers (same results as core/api.ts)', () {
    test('categoriesOf splits and trims', () {
      expect(categoriesOf(' Travel | Vacation |  '), ['Travel', 'Vacation']);
      expect(categoriesOf(''), isEmpty);
    });

    test('wordCount and readingTime', () {
      expect(wordCount(['one two', '  three ']), 3);
      expect(wordCount(['', '']), 0);
      expect(readingTime('a', ''), 1);
      expect(readingTime(List.filled(500, 'w').join(' '), ''), 3); // 2.5 rounds up like Math.round
    });

    test('initials', () {
      expect(initials('Manjunatha M S'), 'MM');
      expect(initials('john_doe'), 'JD');
      expect(initials('***'), '?');
    });

    test('hueOf matches the web implementation', () {
      var h = 0;
      for (final c in 'alice'.codeUnits) {
        h = (h * 31 + c) % 360;
      }
      expect(hueOf('alice'), h);
      expect(hueOf('alice'), inInclusiveRange(0, 359));
    });

    test('compact numbers', () {
      expect(compact(999), '999');
      expect(compact(1500), '1.5K');
    });

    test('displayDate is the stored blog date format', () {
      expect(displayDate(DateTime(2026, 11, 1)), '01-NOV-2026');
    });

    test('passwordStrength levels', () {
      expect(passwordStrength('abc'), 0);
      expect(passwordStrength('abcdef'), 1);
      expect(passwordStrength('abcdefghij'), 2);
      expect(passwordStrength('Abcdefghij'), 3);
      expect(passwordStrength('Abcdefgh1!'), 4);
    });

    test('username and email rules match the API', () {
      expect(usernameRe.hasMatch('ab'), isFalse);
      expect(usernameRe.hasMatch('good.name-1_'), isTrue);
      expect(usernameRe.hasMatch('bad name'), isFalse);
      expect(emailRe.hasMatch('a@b.co'), isTrue);
      expect(emailRe.hasMatch('a@b'), isFalse);
    });
  });

  group('story lists', () {
    final blogs = [
      blog('1', cate: 'Travel | Ocean', title: 'Beta', likes: 1, views: 9),
      blog('2', cate: 'Art', title: 'Alpha', likes: 5, views: 1),
      blog('3', cate: 'travel', title: 'Gamma', likes: 5, views: 4, auth: 'zed'),
    ];

    test('filterStories searches every field and sorts', () {
      expect(filterStories(blogs, 'zed', StorySort.newest).map((b) => b.id), ['3']);
      expect(filterStories(blogs, 'TRAVEL', StorySort.newest).map((b) => b.id), ['1', '3']);
      expect(filterStories(blogs, '', StorySort.loved).map((b) => b.id), ['3', '2', '1']);
      expect(filterStories(blogs, '', StorySort.viewed).map((b) => b.id), ['1', '3', '2']);
      expect(filterStories(blogs, '', StorySort.az).map((b) => b.title), ['Alpha', 'Beta', 'Gamma']);
    });

    test('topicCounts orders by count then name', () {
      expect(topicCounts(blogs).map((t) => '${t.name}:${t.count}'), ['Art:1', 'Ocean:1', 'Travel:1', 'travel:1']);
    });

    test('relatedStories prefers shared topics, excludes the story itself', () {
      final related = relatedStories(blogs[0], blogs);
      expect(related.first.id, '3');
      expect(related.map((b) => b.id), isNot(contains('1')));
    });

    test('toggleTopic adds and removes case-insensitively', () {
      expect(toggleTopic('', 'Travel'), 'Travel');
      expect(toggleTopic('Travel', 'Art'), 'Travel | Art');
      expect(toggleTopic('Travel | Art', 'travel'), 'Art');
    });
  });

  group('ApiClient', () {
    test('keeps the bb.sid session cookie and clears it on logout', () async {
      final seen = <String?>[];
      final client = MockClient((req) async {
        seen.add(req.headers['Cookie']);
        return switch (req.url.path) {
          '/loginuser' => http.Response(
            '{}',
            200,
            headers: {'set-cookie': 'bb.sid=s%3Aabc.def; Path=/; Expires=Sat, 08 Nov 2026 10:00:00 GMT; HttpOnly'},
          ),
          '/logout' => http.Response(
            '{}',
            200,
            headers: {'set-cookie': 'bb.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'},
          ),
          _ => http.Response('{}', 200),
        };
      });
      final cookies = MemoryCookieStore();
      final api = ApiClient(baseUrl: 'http://x', client: client, cookies: cookies, manageCookies: true);

      await api.post('/loginuser', {'username': 'u', 'password': 'p'});
      expect(cookies.read(), 's%3Aabc.def');
      await api.get('/myacc');
      expect(seen.last, 'bb.sid=s%3Aabc.def');
      await api.post('/logout');
      expect(cookies.read(), isNull);
      await api.get('/myacc');
      expect(seen.last, isNull);
    });

    test('sends JSON and surfaces API error messages', () async {
      late http.Request sent;
      final api = ApiClient(
        baseUrl: 'http://x',
        manageCookies: true,
        client: MockClient((req) async {
          sent = req;
          return http.Response(jsonEncode({'error': 'Invalid username or password.'}), 401);
        }),
      );
      final err = await api.post('/loginuser', {'username': 'u'}).then<Object?>((_) => null, onError: (Object e) => e);
      expect(sent.headers['Content-Type'], startsWith('application/json'));
      expect(jsonDecode(sent.body), {'username': 'u'});
      expect(err, isA<ApiException>().having((e) => e.status, 'status', 401));
      expect(errorMessage(err!, 'fallback'), 'Invalid username or password.');
    });

    test('network failures become a friendly message', () async {
      final api = ApiClient(baseUrl: 'http://x', client: MockClient((_) => throw http.ClientException('down')));
      final err = await api.get('/blogs').then<Object?>((_) => null, onError: (Object e) => e);
      expect(errorMessage(err!, 'fallback'), 'Cannot reach the server at http://x. Is it running?');
      expect(errorMessage(const ApiException(0, null), 'fallback'), 'Cannot reach the server. Is it running?');
      expect(errorMessage(const ApiException(500, null), 'fallback'), 'fallback');
    });
  });

  test('models parse API JSON', () {
    final b = BlogPost.fromJson({
      '_id': 'x1',
      'auth': 'a',
      'title': 't',
      'cate': 'c',
      'date': 'd',
      'img': 'img1',
      'blogp1': 'p1',
      'blogp2': 'p2',
      'likes': 2,
      'liked': true,
      'views': 7,
      'createdAt': '2026-11-01T00:00:00.000Z',
    });
    expect((b.id, b.likes, b.liked, b.views, b.featured), ('x1', 2, true, 7, false));
    expect(b.createdAt, DateTime.utc(2026, 11, 1));
    final a = Account.fromJson({
      'username': 'u',
      'email': 'e',
      'blogs': [
        {'_id': 'y'},
      ],
    });
    expect(a.blogs.single.id, 'y');
    expect(Leader.fromJson({'username': 'u', 'likes': 3}, 1).rank, 1);
  });
}
