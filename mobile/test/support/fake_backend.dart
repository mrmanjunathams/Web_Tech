import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// In-memory stand-in for the Express API (backend/src/app.js), enough for widget tests.
/// Sessions use the same `bb.sid` cookie, so the app's real cookie handling is exercised.
class FakeBackend {
  FakeBackend({List<Map<String, dynamic>>? blogs}) {
    for (final b in blogs ?? seedBlogs) {
      addBlog(b);
    }
  }

  final users = <String, ({String name, String email, String password})>{};
  final _sessions = <String, String>{};
  final blogs = <Map<String, dynamic>>[];
  final subscribers = <String>{};
  final requests = <String>[];
  var _nextId = 1;

  /// Responds with this status to the next request matching "METHOD path" (then clears it).
  final failNext = <String, int>{};

  static final featured = [
    {
      '_id': 'featured-1',
      'auth': 'Editor',
      'authName': 'Editor',
      'title': 'Featured: The quiet art of travel',
      'cate': 'Travel | Art',
      'date': '01-JAN-2018',
      'img': 'img1',
      'blogp1': 'A featured opening.',
      'blogp2': '<p>A featured ending.</p>',
      'status': 'published',
      'featured': true,
      'likes': 0,
      'liked': false,
      'views': 0,
    },
  ];

  static final seedBlogs = [
    {
      'auth': 'alice',
      'title': 'Ocean dreams',
      'cate': 'Ocean | Travel',
      'img': 'img2',
      'likedBy': ['bob', 'carol'],
      'views': 10,
    },
    {'auth': 'bob', 'title': 'Office life', 'cate': 'Office', 'img': 'img3', 'likedBy': <String>[], 'views': 50},
    {
      'auth': 'alice',
      'title': 'Art of noise',
      'cate': 'Art',
      'img': 'img4',
      'likedBy': ['bob'],
      'views': 3,
    },
  ];

  void addBlog(Map<String, dynamic> b) => blogs.insert(0, {
    '_id': 'b${(_nextId++).toString().padLeft(23, '0')}',
    'date': '01-NOV-2026',
    'blogp1': 'Opening paragraph for ${b['title']}.',
    'blogp2': '<p>The rest of ${b['title']}.</p>',
    'likedBy': <String>[],
    'views': 0,
    'status': 'published',
    'publishAt': '2026-11-01T10:00:00.000Z',
    'createdAt': '2026-11-01T10:00:00.000Z',
    ...b,
  });

  void addUser(String username, {String password = 'secret1', String? email, String name = ''}) =>
      users[username] = (name: name, email: email ?? '$username@example.com', password: password);

  late final http.Client client = MockClient(_handle);

  static String _statusOf(Map<String, dynamic> b) {
    if (b['status'] == 'draft') return 'draft';
    final at = DateTime.tryParse('${b['publishAt']}');
    return at != null && at.isAfter(DateTime.now()) ? 'scheduled' : 'published';
  }

  bool _live(Map<String, dynamic> b) => _statusOf(b) == 'published';

  String _nameOf(String username) {
    final n = users[username]?.name ?? '';
    return n.isEmpty ? username : n;
  }

  /// Like serializeBlog(): a like count instead of the likers list, plus status and author name.
  Map<String, dynamic> _public(Map<String, dynamic> b, String? user) {
    final likedBy = (b['likedBy'] as List).cast<String>();
    return {
      ...b,
      'likes': likedBy.length,
      'liked': user != null && likedBy.contains(user),
      'status': _statusOf(b),
      'authName': _nameOf(b['auth'] as String),
    }..remove('likedBy');
  }

  /// Applies an add/edit body to [b], mimicking blogFields(); returns an error message or null.
  String? _apply(Map<String, dynamic> b, Map<String, dynamic> body, {required bool isNew}) {
    for (final k in ['title', 'cate', 'img', 'blogp1', 'blogp2']) {
      if (body.containsKey(k)) b[k] = '${body[k] ?? ''}'.trim();
    }
    if (body['status'] == 'draft' || body['status'] == 'published') b['status'] = body['status'];
    final wasLive = !isNew && _live(b);
    if (body.containsKey('publishAt')) b['publishAt'] = body['publishAt'];
    if (b['status'] == 'published') {
      final at = DateTime.tryParse('${b['publishAt']}');
      if (at == null || !at.isAfter(DateTime.now())) {
        if (!wasLive) b['publishAt'] = DateTime.now().toUtc().toIso8601String();
      }
      final missing = ['title', 'cate', 'img', 'blogp1', 'blogp2'].where((k) => '${b[k] ?? ''}'.isEmpty);
      if (missing.isNotEmpty) return 'Missing fields: ${missing.join(', ')}';
      b['date'] = '01-NOV-2026';
    } else if ('${b['title'] ?? ''}${b['blogp1'] ?? ''}${b['blogp2'] ?? ''}'.isEmpty) {
      return 'A draft needs a title or some text.';
    }
    return null;
  }

  Future<http.Response> _handle(http.Request req) async {
    final path = req.url.path;
    requests.add('${req.method} $path');
    final sid = RegExp(r'bb\.sid=([^;]+)').firstMatch(req.headers['Cookie'] ?? '')?.group(1);
    final user = sid == null ? null : _sessions[sid];
    final body = req.body.isEmpty ? <String, dynamic>{} : jsonDecode(req.body) as Map<String, dynamic>;

    http.Response json(Object? data, [int status = 200, Map<String, String> headers = const {}]) =>
        http.Response(jsonEncode(data), status, headers: {'content-type': 'application/json', ...headers});
    http.Response error(int status, String message) => json({'error': message}, status);
    http.Response startSession(String username, Object data, [int status = 200]) {
      final id = 's%3A${username}_${_sessions.length}';
      _sessions[id] = username;
      return json(data, status, {
        'set-cookie': 'bb.sid=$id; Path=/; Expires=Sat, 08 Nov 2026 10:00:00 GMT; HttpOnly; SameSite=Lax',
      });
    }

    final forced = failNext.remove('${req.method} $path');
    if (forced != null) return error(forced, forced == 401 ? 'Please sign in first.' : 'Something went wrong.');

    Map<String, dynamic>? find(String id) => blogs.where((b) => b['_id'] == id).firstOrNull;
    Map<String, dynamic> account(String u) => {
      'username': u,
      'name': users[u]!.name,
      'email': users[u]!.email,
      'createdAt': '2026-10-01T10:00:00.000Z',
      'blogs': [for (final b in blogs.where((b) => b['auth'] == u)) _public(b, u)],
    };
    final postMatch = RegExp(r'^/posts/([^/]+)(/like)?$').firstMatch(path);

    switch ((req.method, path)) {
      case ('GET', '/health'):
        return json({'status': 'ok'});
      case ('GET', '/blogs'):
        return json(featured);
      case ('GET', '/BAdd'):
        return json([for (final b in blogs.where(_live)) _public(b, user)]);
      case ('GET', '/stats'):
        final live = blogs.where(_live);
        final likes = live.fold<int>(0, (n, b) => n + (b['likedBy'] as List).length);
        final cats = {for (final b in live) ...(b['cate'] as String).split('|').map((c) => c.trim().toLowerCase())};
        return json({
          'blogs': live.length + featured.length,
          'writers': users.length,
          'categories': cats.length,
          'likes': likes,
        });
      case ('GET', '/leaderboard'):
        final rows = <String, Map<String, dynamic>>{};
        for (final b in blogs.where(_live)) {
          final u = b['auth'] as String;
          final r = rows.putIfAbsent(u, () => {'username': u, 'name': _nameOf(u), 'posts': 0, 'likes': 0, 'views': 0});
          r['posts'] += 1;
          r['likes'] += (b['likedBy'] as List).length;
          r['views'] += b['views'] as int;
        }
        return json(rows.values.toList()..sort((a, b) => (b['likes'] as int) - (a['likes'] as int)));
      case ('POST', '/adduser'):
        final username = '${body['username'] ?? ''}'.trim();
        final name = '${body['name'] ?? ''}'.trim();
        if (name.isEmpty) return error(400, 'Please enter your name (up to 60 characters).');
        if (users.containsKey(username)) return error(409, 'That username is already registered.');
        addUser(username, password: '${body['password']}', email: '${body['email']}', name: name);
        return startSession(username, {'username': username, 'name': name, 'email': body['email']}, 201);
      case ('POST', '/loginuser'):
        final u = users['${body['username']}'];
        if (u == null || u.password != body['password']) return error(401, 'Invalid username or password.');
        return startSession('${body['username']}', {
          'message': 'successful login',
          'username': body['username'],
          'name': u.name,
        });
      case ('POST', '/logout'):
        if (sid != null) _sessions.remove(sid);
        return json(
          {'message': 'logged out'},
          200,
          {'set-cookie': 'bb.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'},
        );
      case ('GET', '/myacc'):
        if (user == null) return error(401, 'Please sign in first.');
        return json(account(user));
      case ('PATCH', '/myacc'):
        if (user == null) return error(401, 'Please sign in first.');
        final name = '${body['name'] ?? ''}'.trim();
        if (name.isEmpty) return error(400, 'Please enter your name (up to 60 characters).');
        final u = users[user]!;
        users[user] = (name: name, email: u.email, password: u.password);
        return json(account(user));
      case ('POST', '/addblog'):
        if (user == null) return error(401, 'Please sign in first.');
        final b = <String, dynamic>{
          'auth': user,
          'likedBy': <String>[],
          'views': 0,
          'status': 'published',
          'publishAt': null,
          'date': '',
        };
        final problem = _apply(b, body, isNew: true);
        if (problem != null) return error(400, problem);
        b['_id'] = 'b${(_nextId++).toString().padLeft(23, '0')}';
        blogs.insert(0, b);
        return json(_public(b, user), 201);
      case ('POST', '/subscribe'):
        final email = '${body['email'] ?? ''}'.toLowerCase();
        if (!email.contains('@')) return error(400, 'Please enter a valid email address.');
        subscribers.add(email);
        return json({'message': 'subscribed'}, 201);
    }

    if (postMatch != null) {
      final id = Uri.decodeComponent(postMatch.group(1)!);
      final like = postMatch.group(2) != null;
      if (req.method == 'GET' && !like) {
        final feat = featured.where((f) => f['_id'] == id).firstOrNull;
        if (feat != null) return json(feat);
        final b = find(id);
        if (b == null || (!_live(b) && b['auth'] != user)) return error(404, 'Blog not found.');
        if (_live(b)) b['views'] = (b['views'] as int) + 1;
        return json(_public(b, user));
      }
      if (user == null) return error(401, 'Please sign in first.');
      final b = find(id);
      if (b == null) return error(404, 'Blog not found.');
      if (req.method == 'POST' && like) {
        if (!_live(b)) return error(404, 'Blog not found.');
        final likedBy = b['likedBy'] as List;
        final liked = !likedBy.contains(user);
        liked ? likedBy.add(user) : likedBy.remove(user);
        return json({'likes': likedBy.length, 'liked': liked});
      }
      if (b['auth'] != user) return error(403, 'You can only change your own blogs.');
      if (req.method == 'PATCH') {
        final copy = Map<String, dynamic>.of(b);
        final problem = _apply(copy, body, isNew: false);
        if (problem != null) return error(400, problem);
        b.addAll(copy);
        return json(_public(b, user));
      }
      if (req.method == 'DELETE') {
        blogs.remove(b);
        return json({'message': 'deleted'});
      }
    }
    return error(404, 'Not found');
  }
}
