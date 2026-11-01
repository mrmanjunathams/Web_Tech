import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../shell.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/feedback.dart';
import '../widgets/footer.dart';
import '../widgets/post_card.dart';

const _tabs = [
  (
    BlogStatus.published,
    'Published',
    Icons.public,
    'Nothing published yet',
    'Pick a cover, write your story, hit publish. It takes five minutes.',
  ),
  (
    BlogStatus.scheduled,
    'Scheduled',
    Icons.schedule,
    'Nothing scheduled',
    'Stories you schedule appear here until they go live.',
  ),
  (
    BlogStatus.draft,
    'Drafts',
    Icons.edit_note,
    'No drafts',
    'Save a draft any time and finish it later. Drafts are private.',
  ),
];

/// The signed-in writer's dashboard (the web's /myacc).
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  bool _started = false;
  BlogStatus? _tab;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    // Fresh numbers every time the dashboard opens (the web's guard reloads too).
    AppScope.of(context).auth.load();
  }

  Future<void> _remove(BlogPost b) async {
    final ok = await confirmDialog(
      context,
      title: 'Delete this story?',
      text: '"${b.title.isEmpty ? 'Untitled draft' : b.title}" will be gone for good.',
      okLabel: 'Delete',
      danger: true,
    );
    if (!ok || !mounted) return;
    final services = AppScope.of(context);
    try {
      await services.posts.remove(b.id);
      await services.auth.load();
      showToast('Story deleted.', ToastKind.success);
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this story.'), ToastKind.error);
    }
  }

  Future<void> _editName(Account user) async {
    final auth = AppScope.of(context).auth;
    final name = await showDialog<String>(
      context: context,
      builder: (_) => _NameDialog(initial: user.name),
    );
    if (name == null || name.trim().isEmpty) return;
    try {
      await auth.rename(name.trim());
      showToast('Name updated.', ToastKind.success);
    } catch (err) {
      showToast(errorMessage(err, 'Could not update your name.'), ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = AppScope.of(context).auth;
    return PageScaffold(
      title: 'Dashboard',
      body: ListenableBuilder(
        listenable: auth,
        builder: (context, _) {
          final user = auth.user;
          if (user == null) {
            // Signed out while here (or the session expired).
            return Padding(
              padding: const EdgeInsets.all(20),
              child: EmptyState(
                icon: Icons.lock,
                title: 'Please sign in first.',
                action: 'Sign in',
                onAction: () => context.pushReplacement('/login'),
              ),
            );
          }
          return RefreshIndicator(onRefresh: auth.load, child: _body(context, user));
        },
      ),
    );
  }

  Widget _body(BuildContext context, Account user) {
    final t = Theme.of(context).textTheme;
    final pal = Palette.of(context);
    final blogs = user.blogs;
    final live = blogs.where((b) => b.isLive).toList();
    int count(BlogStatus s) => blogs.where((b) => b.status == s).length;
    // Opens on drafts when nothing is published yet.
    final tab = _tab ?? (live.isEmpty && count(BlogStatus.draft) > 0 ? BlogStatus.draft : BlogStatus.published);
    final shown = blogs.where((b) => b.status == tab).toList();
    final (_, _, _, emptyTitle, emptyText) = _tabs.firstWhere((x) => x.$1 == tab);
    final tiles = [
      (Icons.article, 'Stories', live.length),
      (Icons.favorite, 'Likes received', live.fold(0, (n, b) => n + b.likes)),
      (Icons.visibility, 'Views', live.fold(0, (n, b) => n + b.views)),
      (Icons.notes, 'Words written', blogs.fold(0, (n, b) => n + storyWords(b.blogp1, b.blogp2))),
    ];

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        Padding(
          padding: const EdgeInsets.all(20),
          child: Glass(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Avatar(user.displayName, size: 72),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Eyebrow('Dashboard'),
                          Text(user.displayName, style: t.headlineSmall, key: const Key('profile-name')),
                        ],
                      ),
                    ),
                    IconButton(
                      key: const Key('edit-name'),
                      tooltip: 'Edit your name',
                      icon: const Icon(Icons.edit),
                      onPressed: () => _editName(user),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('@${user.username} · ', style: TextStyle(color: pal.muted)),
                    InkWell(
                      onTap: () => openExternal(Uri(scheme: 'mailto', path: user.email)),
                      child: Text(
                        user.email,
                        style: const TextStyle(color: Brand.brand, fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (user.createdAt != null)
                      Text(
                        ' · Joined ${DateFormat('MMM yyyy', 'en_US').format(user.createdAt!.toLocal())}',
                        style: TextStyle(color: pal.muted),
                      ),
                  ],
                ),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: () => context.push('/writeblog'),
                      icon: const Icon(Icons.edit_square),
                      label: const Text('New story'),
                    ),
                    OutlinedButton.icon(
                      key: const Key('logout'),
                      onPressed: () => signOut(context),
                      icon: const Icon(Icons.logout),
                      label: const Text('Log out'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (user.name.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Glass(
              key: const Key('name-banner'),
              child: Row(
                children: [
                  const Icon(Icons.badge, color: Brand.brand),
                  const SizedBox(width: 12),
                  const Expanded(child: Text('Add your name so readers know who wrote your stories.')),
                  TextButton(onPressed: () => _editName(user), child: const Text('Add name')),
                ],
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: GridView(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              mainAxisExtent: 128,
            ),
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final (icon, label, value) in tiles)
                Glass(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, color: Brand.brand),
                      const SizedBox(height: 6),
                      FittedBox(child: CountUp(value, style: t.headlineSmall)),
                      Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: pal.muted),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        SectionHeader(eyebrow: 'Your work', title: blogs.isNotEmpty ? 'Your stories' : 'Your first story awaits'),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            children: [
              for (final (status, label, icon, _, _) in _tabs)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    key: Key('tab-${status.name}'),
                    avatar: Icon(icon, size: 18),
                    label: Text('$label  ${count(status)}'),
                    selected: tab == status,
                    onSelected: (_) => setState(() => _tab = status),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        if (shown.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: EmptyState(
              icon: Icons.draw,
              title: emptyTitle,
              text: emptyText,
              action: 'Write a story',
              onAction: () => context.push('/writeblog'),
            ),
          )
        else
          CardGrid(
            children: [
              for (final b in shown)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    PostCard(
                      post: b,
                      // Live stories open in the reader; drafts and scheduled ones in the studio.
                      onTap: b.isLive ? null : () => context.push(_editPath(b)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton.filled(
                            tooltip: 'Edit ${b.title.isEmpty ? 'draft' : b.title}',
                            style: IconButton.styleFrom(backgroundColor: Colors.black54, foregroundColor: Colors.white),
                            icon: const Icon(Icons.edit),
                            onPressed: () => context.push(_editPath(b)),
                          ),
                          const SizedBox(width: 6),
                          IconButton.filled(
                            tooltip: 'Delete ${b.title.isEmpty ? 'draft' : b.title}',
                            style: IconButton.styleFrom(backgroundColor: Colors.black54, foregroundColor: Colors.white),
                            icon: const Icon(Icons.delete),
                            onPressed: () => _remove(b),
                          ),
                        ],
                      ),
                    ),
                    if (b.status == BlogStatus.scheduled && b.publishAt != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6, left: 4),
                        child: Text('Goes live ${formatWhen(b.publishAt!)}', style: TextStyle(color: pal.muted)),
                      ),
                  ],
                ),
            ],
          ),
      ],
    );
  }

  static String _editPath(BlogPost b) => Uri(path: '/writeblog', queryParameters: {'id': b.id}).toString();
}

/// Asks for a display name. Owns its text controller, so it is disposed only after the dialog has closed.
class _NameDialog extends StatefulWidget {
  const _NameDialog({required this.initial});

  final String initial;

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  late final _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Your name'),
    content: TextField(
      key: const Key('name-input'),
      controller: _controller,
      autofocus: true,
      maxLength: 60,
      textCapitalization: TextCapitalization.words,
      decoration: const InputDecoration(hintText: 'Shown on your stories'),
      onSubmitted: (v) => Navigator.pop(context, v),
    ),
    actions: [
      TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
      FilledButton(onPressed: () => Navigator.pop(context, _controller.text), child: const Text('Save')),
    ],
  );
}
