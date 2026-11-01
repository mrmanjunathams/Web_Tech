import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'api_client.dart';
import 'models.dart';

/// Blog API calls (port of core/posts.ts).
class PostsApi {
  PostsApi(this._api, {AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final ApiClient _api;
  final AssetBundle _bundle;

  /// Bumped whenever a story is published, deleted or liked, so open lists can refresh.
  final changes = ValueNotifier<int>(0);

  /// User-published blogs, newest first.
  Future<List<BlogPost>> all() async => listOf(await _api.get('/BAdd'), BlogPost.fromJson);

  Future<List<BlogPost>> featured() async => listOf(await _api.get('/blogs'), BlogPost.fromJson);

  Future<BlogPost> get(String id) async =>
      BlogPost.fromJson(await _api.get('/posts/${Uri.encodeComponent(id)}') as Map<String, dynamic>);

  Future<({int likes, bool liked})> like(String id) async {
    final res = await _api.post('/posts/${Uri.encodeComponent(id)}/like') as Map<String, dynamic>;
    changes.value++;
    return (likes: (res['likes'] as num).toInt(), liked: res['liked'] == true);
  }

  Future<void> remove(String id) async {
    await _api.delete('/posts/${Uri.encodeComponent(id)}');
    changes.value++;
  }

  /// Publishes now, schedules (future [BlogInput.publishAt]) or saves a draft (status 'draft').
  Future<BlogPost> create(BlogInput input) async {
    final created = BlogPost.fromJson(await _api.post('/addblog', input.toJson()) as Map<String, dynamic>);
    changes.value++;
    return created;
  }

  /// Edits your own story: content, draft/publish, schedule.
  Future<BlogPost> update(String id, BlogInput input) async {
    final updated = BlogPost.fromJson(
      await _api.patch('/posts/${Uri.encodeComponent(id)}', input.toJson()) as Map<String, dynamic>,
    );
    changes.value++;
    return updated;
  }

  Future<Stats> stats() async => Stats.fromJson(await _api.get('/stats') as Map<String, dynamic>);

  Future<List<Leader>> leaderboard() async {
    final rows = await _api.get('/leaderboard');
    return rows is List
        ? [for (final (i, r) in rows.whereType<Map<String, dynamic>>().indexed) Leader.fromJson(r, i + 1)]
        : <Leader>[];
  }

  Future<void> subscribe(String email) => _api.post('/subscribe', {'email': email});

  /// Image Pool picture names, from the bundled manifest so the gallery works offline.
  Future<List<String>> images() async =>
      (jsonDecode(await _bundle.loadString('assets/picyourpic/manifest.json')) as List).cast<String>();
}
