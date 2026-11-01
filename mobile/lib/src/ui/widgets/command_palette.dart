import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/models.dart';
import '../../state/app_scope.dart';
import '../theme.dart';

class _Command {
  const _Command(this.id, this.label, this.hint, this.icon, this.group, this.run);

  final String id;
  final String label;
  final String hint;
  final IconData icon;
  final String group;
  final void Function(BuildContext context) run;
}

/// Quick switcher for pages, actions and stories (port of shared/command-palette.ts).
Future<void> showCommandPalette(BuildContext context) =>
    showDialog(context: context, builder: (_) => const CommandPalette());

class CommandPalette extends StatefulWidget {
  const CommandPalette({super.key});

  @override
  State<CommandPalette> createState() => _CommandPaletteState();
}

class _CommandPaletteState extends State<CommandPalette> {
  static List<BlogPost>? _cache;

  final _query = TextEditingController();
  List<BlogPost> _stories = _cache ?? const [];

  @override
  void initState() {
    super.initState();
    _query.addListener(() => setState(() {}));
    if (_cache == null) _loadStories();
  }

  Future<void> _loadStories() async {
    final posts = AppScope.of(context).posts;
    try {
      final [featured, all] = await Future.wait([posts.featured(), posts.all()]);
      _cache = [...featured, ...all];
      if (mounted) setState(() => _stories = _cache!);
    } catch (_) {
      // Pages and actions still work offline.
    }
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  List<_Command> _commands(BuildContext context) {
    final services = AppScope.of(context);
    final user = services.auth.user;
    void Function(BuildContext) go(String path) =>
        (c) => c.go(path);
    void Function(BuildContext) push(String path) =>
        (c) => c.push(path);
    return [
      _Command('p-home', 'Home', 'Start page', Icons.home, 'Pages', go('/')),
      _Command('p-blog', 'Featured stories', 'Blog', Icons.auto_stories, 'Pages', go('/blog')),
      _Command('p-cate', 'Explore', 'All stories by category', Icons.explore, 'Pages', go('/cate')),
      _Command('p-rewards', 'Leaderboard', 'Top writers', Icons.military_tech, 'Pages', go('/rewards')),
      _Command('p-gallery', 'Image Pool', 'Pictures for your story', Icons.photo_library, 'Pages', go('/gallery')),
      _Command('p-about', 'About us', 'Our story', Icons.info, 'Pages', push('/aboutme')),
      _Command(
        'a-write',
        'Write a new story',
        user != null ? 'Editor' : 'Sign in first',
        Icons.edit_square,
        'Actions',
        push('/writeblog'),
      ),
      _Command('a-theme', 'Toggle light / dark', 'Theme', Icons.contrast, 'Actions', services.theme.toggle),
      if (user != null)
        _Command('a-acc', 'My dashboard', user.displayName, Icons.space_dashboard, 'Actions', push('/myacc'))
      else ...[
        _Command('a-login', 'Sign in', 'Account', Icons.login, 'Actions', push('/login')),
        _Command('a-signup', 'Create account', 'Free', Icons.person_add, 'Actions', push('/signup')),
      ],
      for (final b in _stories)
        _Command(
          's-${b.id}',
          b.title,
          '${b.author} · ${b.cate}',
          Icons.article,
          'Stories',
          push('/post/${Uri.encodeComponent(b.id)}'),
        ),
    ];
  }

  List<_Command> _results(BuildContext context) {
    final q = _query.text.trim().toLowerCase();
    final all = _commands(context);
    if (q.isEmpty) {
      return [...all.where((c) => c.group != 'Stories'), ...all.where((c) => c.group == 'Stories').take(5)];
    }
    return all.where((c) => '${c.label} ${c.hint}'.toLowerCase().contains(q)).take(30).toList();
  }

  void _exec(_Command c) {
    // Run against the page underneath, after the dialog is gone.
    final nav = Navigator.of(context);
    final target = nav.context;
    nav.pop();
    c.run(target);
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final results = _results(context);
    return Dialog(
      alignment: Alignment.topCenter,
      insetPadding: const EdgeInsets.fromLTRB(16, 56, 16, 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Brand.radius),
        side: BorderSide(color: p.border),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640, maxHeight: 560),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                key: const Key('palette-search'),
                controller: _query,
                autofocus: true,
                textInputAction: TextInputAction.go,
                onSubmitted: (_) {
                  if (results.isNotEmpty) _exec(results.first);
                },
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search stories, pages, actions…',
                ),
              ),
            ),
            Flexible(
              child: results.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('No matches for "${_query.text}"', style: TextStyle(color: p.muted)),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: results.length,
                      itemBuilder: (context, i) {
                        final c = results[i];
                        final tile = ListTile(
                          leading: Icon(c.icon, color: Brand.brand),
                          title: Text(c.label, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text(
                            c.hint,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: p.muted),
                          ),
                          onTap: () => _exec(c),
                        );
                        if (i > 0 && results[i - 1].group == c.group) return tile;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                              child: Text(
                                c.group.toUpperCase(),
                                style: TextStyle(
                                  color: p.muted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.4,
                                ),
                              ),
                            ),
                            tile,
                          ],
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
