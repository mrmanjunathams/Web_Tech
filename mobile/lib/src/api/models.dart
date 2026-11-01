/// API shapes, mirroring frontend/src/app/core/api.ts.
library;

/// 'scheduled' = published with a future publishAt; only the author sees drafts and scheduled stories.
enum BlogStatus {
  draft,
  scheduled,
  published;

  static BlogStatus parse(Object? v) => switch (v) {
    'draft' => draft,
    'scheduled' => scheduled,
    _ => published,
  };
}

class BlogPost {
  const BlogPost({
    required this.id,
    required this.auth,
    required this.title,
    required this.cate,
    required this.date,
    required this.img,
    required this.blogp1,
    required this.blogp2,
    this.authName = '',
    this.status = BlogStatus.published,
    this.publishAt,
    this.likes = 0,
    this.liked = false,
    this.views = 0,
    this.featured = false,
    this.createdAt,
    this.updatedAt,
  });

  final String id;

  /// Author's username (identity). Show [author] instead.
  final String auth;

  /// Author's display name (may be empty for older data).
  final String authName;
  final String title;
  final String cate;
  final String date;
  final String img;

  /// Opening paragraph, plain text (also the card excerpt).
  final String blogp1;

  /// Story body: sanitized HTML from the rich-text editor.
  final String blogp2;
  final BlogStatus status;
  final DateTime? publishAt;
  final int likes;
  final bool liked;
  final int views;
  final bool featured;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Name to show for the author.
  String get author => authName.isNotEmpty ? authName : auth;

  bool get isLive => status == BlogStatus.published;

  factory BlogPost.fromJson(Map<String, dynamic> j) => BlogPost(
    id: '${j['_id']}',
    auth: _s(j['auth']),
    authName: _s(j['authName']),
    title: _s(j['title']),
    cate: _s(j['cate']),
    date: _s(j['date']),
    img: _s(j['img']),
    blogp1: _s(j['blogp1']),
    blogp2: _s(j['blogp2']),
    status: BlogStatus.parse(j['status']),
    publishAt: DateTime.tryParse(_s(j['publishAt'])),
    likes: _i(j['likes']),
    liked: j['liked'] == true,
    views: _i(j['views']),
    featured: j['featured'] == true,
    createdAt: DateTime.tryParse(_s(j['createdAt'])),
    updatedAt: DateTime.tryParse(_s(j['updatedAt'])),
  );

  BlogPost copyWith({int? likes, bool? liked}) => BlogPost(
    id: id,
    auth: auth,
    authName: authName,
    title: title,
    cate: cate,
    date: date,
    img: img,
    blogp1: blogp1,
    blogp2: blogp2,
    status: status,
    publishAt: publishAt,
    likes: likes ?? this.likes,
    liked: liked ?? this.liked,
    views: views,
    featured: featured,
    createdAt: createdAt,
    updatedAt: updatedAt,
  );
}

class Account {
  const Account({required this.username, required this.email, this.name = '', this.createdAt, this.blogs = const []});

  final String username;

  /// Display name; empty for accounts created before names existed.
  final String name;
  final String email;
  final DateTime? createdAt;
  final List<BlogPost> blogs;

  String get displayName => name.isNotEmpty ? name : username;

  factory Account.fromJson(Map<String, dynamic> j) => Account(
    username: _s(j['username']),
    name: _s(j['name']),
    email: _s(j['email']),
    createdAt: DateTime.tryParse(_s(j['createdAt'])),
    blogs: listOf(j['blogs'], BlogPost.fromJson),
  );
}

class Stats {
  const Stats({this.blogs = 0, this.writers = 0, this.categories = 0, this.likes = 0});

  final int blogs;
  final int writers;
  final int categories;
  final int likes;

  factory Stats.fromJson(Map<String, dynamic> j) =>
      Stats(blogs: _i(j['blogs']), writers: _i(j['writers']), categories: _i(j['categories']), likes: _i(j['likes']));
}

class Leader {
  const Leader({required this.username, this.name = '', this.posts = 0, this.likes = 0, this.views = 0, this.rank = 0});

  final String username;
  final String name;
  final int posts;
  final int likes;
  final int views;

  /// 1-based position in the leaderboard (set client-side).
  final int rank;

  String get displayName => name.isNotEmpty ? name : username;

  factory Leader.fromJson(Map<String, dynamic> j, int rank) => Leader(
    username: _s(j['username']),
    name: _s(j['name']),
    posts: _i(j['posts']),
    likes: _i(j['likes']),
    views: _i(j['views']),
    rank: rank,
  );
}

/// What the editor sends; null fields are left out (drafts may be incomplete).
class BlogInput {
  const BlogInput({
    this.title,
    this.cate,
    this.img,
    this.blogp1,
    this.blogp2,
    this.status,
    this.publishAt,
    this.publishNow = false,
  });

  final String? title;
  final String? cate;
  final String? img;
  final String? blogp1;
  final String? blogp2;

  /// 'draft' or 'published'.
  final String? status;

  /// When to go live (a future time schedules the story).
  final DateTime? publishAt;

  /// Sends `publishAt: null` (go live now / clear a schedule).
  final bool publishNow;

  Map<String, Object?> toJson() => {
    'title': ?title,
    'cate': ?cate,
    'img': ?img,
    'blogp1': ?blogp1,
    'blogp2': ?blogp2,
    'status': ?status,
    if (publishAt != null) 'publishAt': publishAt!.toUtc().toIso8601String() else if (publishNow) 'publishAt': null,
  };
}

List<T> listOf<T>(Object? json, T Function(Map<String, dynamic>) parse) =>
    json is List ? json.whereType<Map<String, dynamic>>().map(parse).toList() : <T>[];

String _s(Object? v) => v is String ? v : (v == null ? '' : '$v');
int _i(Object? v) => v is num ? v.toInt() : 0;
