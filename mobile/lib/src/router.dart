import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import 'state/auth.dart';
import 'ui/screens/about.dart';
import 'ui/screens/account.dart';
import 'ui/screens/explore.dart';
import 'ui/screens/gallery.dart';
import 'ui/screens/home.dart';
import 'ui/screens/leaderboard.dart';
import 'ui/screens/login.dart';
import 'ui/screens/post.dart';
import 'ui/screens/signup.dart';
import 'ui/screens/stories.dart';
import 'ui/screens/write.dart';
import 'ui/shell.dart';

/// Same paths as the web app's hash routes, so links like `/cate?q=Travel` or `/post/:id` work in both.
GoRouter buildRouter(AuthController auth, {String initialLocation = '/'}) {
  // Signed-in only pages (the web's authGuard).
  const protected = {'/myacc', '/writeblog'};

  NoTransitionPage<void> tab(GoRouterState s, Widget child) => NoTransitionPage(key: s.pageKey, child: child);

  return GoRouter(
    initialLocation: initialLocation,
    redirect: (context, state) async {
      if (!protected.contains(state.matchedLocation)) return null;
      return await auth.ensureLoaded() == null ? '/login' : null;
    },
    onException: (context, state, router) => router.go('/'),
    routes: [
      ShellRoute(
        builder: (context, state, child) => AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/', pageBuilder: (c, s) => tab(s, const HomeScreen())),
          GoRoute(path: '/blog', pageBuilder: (c, s) => tab(s, const StoriesScreen())),
          GoRoute(
            path: '/cate',
            pageBuilder: (c, s) => tab(s, ExploreScreen(query: s.uri.queryParameters['q'] ?? '')),
          ),
          GoRoute(path: '/rewards', pageBuilder: (c, s) => tab(s, const LeaderboardScreen())),
          GoRoute(path: '/gallery', pageBuilder: (c, s) => tab(s, const GalleryScreen())),
        ],
      ),
      GoRoute(
        path: '/post/:id',
        builder: (c, s) => PostScreen(id: s.pathParameters['id']!),
      ),
      GoRoute(path: '/aboutme', builder: (c, s) => const AboutScreen()),
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (c, s) => const SignupScreen()),
      GoRoute(path: '/myacc', builder: (c, s) => const AccountScreen()),
      GoRoute(
        path: '/writeblog',
        builder: (c, s) => WriteScreen(id: s.uri.queryParameters['id'], initialImage: s.uri.queryParameters['img']),
      ),
    ],
  );
}

/// Closes every pushed screen (keeping the current tab underneath) and opens [path].
/// Used after sign-in, publishing and deleting, where the web app navigates away.
void resetTo(BuildContext context, String path) {
  final router = GoRouter.of(context);
  while (router.canPop()) {
    router.pop();
  }
  router.push(path);
}
