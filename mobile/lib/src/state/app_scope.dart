import 'package:flutter/widgets.dart';

import '../api/posts_api.dart';
import 'auth.dart';
import 'storage.dart';

/// App-wide services, available to every widget via `AppScope.of(context)`.
class AppServices {
  AppServices({required this.posts, required this.auth, required this.theme, required this.drafts});

  final PostsApi posts;
  final AuthController auth;
  final ThemeController theme;
  final DraftStore drafts;
}

class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.services, required super.child});

  final AppServices services;

  static AppServices of(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'No AppScope found in context');
    return scope!.services;
  }

  @override
  bool updateShouldNotify(AppScope oldWidget) => services != oldWidget.services;
}
