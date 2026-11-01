import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../state/app_scope.dart';
import 'theme.dart';
import 'widgets/command_palette.dart';
import 'widgets/common.dart';
import 'widgets/feedback.dart';

/// Main sections, shown in the bottom bar (and the drawer, with About).
const shellTabs = [
  (path: '/', label: 'Home', icon: Icons.home_outlined, selected: Icons.home),
  (path: '/blog', label: 'Stories', icon: Icons.auto_stories_outlined, selected: Icons.auto_stories),
  (path: '/cate', label: 'Explore', icon: Icons.explore_outlined, selected: Icons.explore),
  (path: '/rewards', label: 'Leaderboard', icon: Icons.military_tech_outlined, selected: Icons.military_tech),
  (path: '/gallery', label: 'Image Pool', icon: Icons.photo_library_outlined, selected: Icons.photo_library),
];

Future<void> signOut(BuildContext context) async {
  final router = GoRouter.of(context);
  await AppScope.of(context).auth.logout();
  showToast('Signed out. See you soon!', ToastKind.success);
  router.go('/');
}

/// App bar actions shared by every screen: search, theme toggle, account.
List<Widget> appBarActions(BuildContext context) {
  final services = AppScope.of(context);
  return [
    IconButton(tooltip: 'Search', icon: const Icon(Icons.search), onPressed: () => showCommandPalette(context)),
    ListenableBuilder(
      listenable: services.theme,
      builder: (context, _) {
        final dark = services.theme.isDark(context);
        return IconButton(
          tooltip: dark ? 'Switch to light theme' : 'Switch to dark theme',
          icon: Icon(dark ? Icons.light_mode : Icons.dark_mode),
          onPressed: () => services.theme.toggle(context),
        );
      },
    ),
    ListenableBuilder(
      listenable: services.auth,
      builder: (context, _) {
        final user = services.auth.user;
        if (user == null) {
          return Padding(
            padding: const EdgeInsets.only(right: 4),
            child: TextButton(onPressed: () => context.push('/login'), child: const Text('Sign in')),
          );
        }
        return PopupMenuButton<String>(
          tooltip: 'Account menu',
          position: PopupMenuPosition.under,
          onSelected: (v) => switch (v) {
            'logout' => signOut(context),
            _ => context.push(v),
          },
          itemBuilder: (context) => [
            PopupMenuItem(
              enabled: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.displayName,
                    style: TextStyle(color: Palette.of(context).text, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    '@${user.username} · ${user.email}',
                    style: TextStyle(color: Palette.of(context).muted, fontSize: 12),
                  ),
                ],
              ),
            ),
            const PopupMenuDivider(),
            const PopupMenuItem(
              value: '/myacc',
              child: ListTile(leading: Icon(Icons.space_dashboard), title: Text('Dashboard')),
            ),
            const PopupMenuItem(
              value: '/writeblog',
              child: ListTile(leading: Icon(Icons.edit_square), title: Text('New story')),
            ),
            const PopupMenuItem(
              value: 'logout',
              child: ListTile(leading: Icon(Icons.logout), title: Text('Log out')),
            ),
          ],
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Avatar(user.displayName, size: 34),
          ),
        );
      },
    ),
  ];
}

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  int get _index {
    final i = shellTabs.indexWhere((t) => t.path != '/' && location.startsWith(t.path));
    return i < 0 ? 0 : i;
  }

  @override
  Widget build(BuildContext context) {
    final auth = AppScope.of(context).auth;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: InkWell(
          onTap: () => context.go('/'),
          child: Semantics(
            label: 'Bloggerbytes home',
            child: const ExcludeSemantics(child: Logo()),
          ),
        ),
        actions: appBarActions(context),
      ),
      drawer: const AppDrawer(),
      body: child,
      floatingActionButton: ListenableBuilder(
        listenable: auth,
        builder: (context, _) => auth.user == null
            ? const SizedBox.shrink()
            : FloatingActionButton.extended(
                heroTag: 'write',
                backgroundColor: Brand.brand,
                foregroundColor: const Color(0xFF041615),
                onPressed: () => context.push('/writeblog'),
                icon: const Icon(Icons.edit_square),
                label: const Text('Write', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => context.go(shellTabs[i].path),
        destinations: [
          for (final t in shellTabs)
            NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.selected), label: t.label),
        ],
      ),
    );
  }
}

/// Full menu (the web's mobile sheet).
class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AppScope.of(context).auth;
    void go(String path, {bool push = false}) {
      final router = GoRouter.of(context);
      Navigator.pop(context);
      push ? router.push(path) : router.go(path);
    }

    return Drawer(
      child: SafeArea(
        child: ListenableBuilder(
          listenable: auth,
          builder: (context, _) {
            final user = auth.user;
            return ListView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                  child: const Align(alignment: Alignment.centerLeft, child: Logo(height: 56)),
                ),
                for (final t in shellTabs)
                  ListTile(leading: Icon(t.icon), title: Text(t.label), onTap: () => go(t.path)),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('About'),
                  onTap: () => go('/aboutme', push: true),
                ),
                const Divider(),
                if (user != null) ...[
                  ListTile(
                    leading: const Icon(Icons.space_dashboard_outlined),
                    title: const Text('Dashboard'),
                    onTap: () => go('/myacc', push: true),
                  ),
                  ListTile(
                    leading: const Icon(Icons.edit_square),
                    title: const Text('Write'),
                    onTap: () => go('/writeblog', push: true),
                  ),
                  ListTile(
                    leading: const Icon(Icons.logout),
                    title: const Text('Log out'),
                    onTap: () {
                      signOut(context);
                      Navigator.pop(context);
                    },
                  ),
                ] else ...[
                  ListTile(
                    leading: const Icon(Icons.login),
                    title: const Text('Sign in'),
                    onTap: () => go('/login', push: true),
                  ),
                  ListTile(
                    leading: const Icon(Icons.person_add_alt),
                    title: const Text('Create account'),
                    onTap: () => go('/signup', push: true),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Scaffold for screens pushed on top of the shell (story, editor, account...).
class PageScaffold extends StatelessWidget {
  const PageScaffold({super.key, required this.body, this.title});

  final Widget body;
  final String? title;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: title == null ? null : Text(title!, style: const TextStyle(fontWeight: FontWeight.w800)),
      actions: appBarActions(context),
    ),
    body: body,
  );
}
