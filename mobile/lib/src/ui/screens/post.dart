import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../config.dart';
import '../../router.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../shell.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/feedback.dart';
import '../widgets/footer.dart' show openExternal;
import '../widgets/post_card.dart';

/// Up to three stories sharing the most topics with [post], then the most liked.
List<BlogPost> relatedStories(BlogPost post, List<BlogPost> others) {
  final mine = categoriesOf(post.cate).map((c) => c.toLowerCase()).toSet();
  int score(BlogPost b) => categoriesOf(b.cate).where((c) => mine.contains(c.toLowerCase())).length;
  return (others.where((b) => b.id != post.id).toList()
        ..sort((a, b) => score(a) != score(b) ? score(b) - score(a) : b.likes - a.likes))
      .take(3)
      .toList();
}

/// One story, full screen (the web's /post/:id reader).
class PostScreen extends StatefulWidget {
  const PostScreen({super.key, required this.id});

  final String id;

  @override
  State<PostScreen> createState() => _PostScreenState();
}

class _PostScreenState extends State<PostScreen> with SingleTickerProviderStateMixin {
  final _scroll = ScrollController();
  final _progress = ValueNotifier<double>(0);
  late final _burst = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

  BlogPost? _post;
  List<BlogPost> _others = const [];
  String _error = '';
  bool _loadStarted = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loadStarted) return;
    _loadStarted = true;
    _load();
    _loadOthers();
  }

  @override
  void didUpdateWidget(PostScreen old) {
    super.didUpdateWidget(old);
    if (old.id != widget.id) _load();
  }

  @override
  void dispose() {
    _scroll.dispose();
    _progress.dispose();
    _burst.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _post = null;
      _error = '';
    });
    try {
      final post = await AppScope.of(context).posts.get(widget.id);
      if (mounted) setState(() => _post = post);
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Could not load this story.'));
    }
  }

  Future<void> _loadOthers() async {
    final posts = AppScope.of(context).posts;
    try {
      final [featured, all] = await Future.wait([posts.featured(), posts.all()]);
      if (mounted) setState(() => _others = [...all, ...featured]);
    } catch (_) {
      // "More like this" is optional.
    }
  }

  void _onScroll() {
    final max = _scroll.position.maxScrollExtent;
    _progress.value = max > 0 ? (_scroll.offset / max).clamp(0, 1) : 0;
  }

  bool get _isMine {
    final p = _post!;
    return !p.featured && p.auth == AppScope.of(context).auth.user?.username;
  }

  // like/share/remove are only on screen once the story has loaded.
  Future<void> _like() async {
    final p = _post!;
    final services = AppScope.of(context);
    if (services.auth.user == null) {
      showToast('Sign in to like stories.');
      context.push('/login');
      return;
    }
    // Optimistic update; reconciled with the server's answer.
    final liked = !p.liked;
    setState(() => _post = p.copyWith(liked: liked, likes: p.likes + (liked ? 1 : -1)));
    if (liked) _burst.forward(from: 0);
    try {
      final res = await services.posts.like(p.id);
      // The reader may have moved on to another story meanwhile.
      if (mounted && _post?.id == p.id) setState(() => _post = _post!.copyWith(likes: res.likes, liked: res.liked));
    } catch (err) {
      if (mounted && _post?.id == p.id) setState(() => _post = p);
      showToast(errorMessage(err, 'Could not update your like.'), ToastKind.error);
    }
  }

  Future<void> _share() async {
    final p = _post!;
    final url = '${AppConfig.siteUrl}/#/post/${Uri.encodeComponent(p.id)}';
    try {
      await SharePlus.instance.share(ShareParams(title: p.title, text: '${p.title}\n$url'));
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: url));
      showToast('Link copied to clipboard.', ToastKind.success);
    }
  }

  Future<void> _remove() async {
    final p = _post!;
    final ok = await confirmDialog(
      context,
      title: 'Delete this story?',
      text: '"${p.title.isEmpty ? 'Untitled draft' : p.title}" will be gone for good.',
      okLabel: 'Delete',
      danger: true,
    );
    if (!ok || !mounted) return;
    final services = AppScope.of(context);
    try {
      await services.posts.remove(p.id);
      await services.auth.load();
      showToast('Story deleted.', ToastKind.success);
      if (mounted) resetTo(context, '/myacc');
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this story.'), ToastKind.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _post;
    if (_error.isNotEmpty) {
      return PageScaffold(
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Center(
            child: EmptyState(
              icon: Icons.sentiment_dissatisfied,
              title: _error,
              action: 'Explore other stories',
              onAction: () => context.go('/cate'),
            ),
          ),
        ),
      );
    }
    if (p == null) {
      return const PageScaffold(
        body: Padding(padding: EdgeInsets.all(20), child: Skeleton(height: 520)),
      );
    }

    final t = Theme.of(context).textTheme;
    final pal = Palette.of(context);
    final related = relatedStories(p, _others);
    final words = storyWords(p.blogp1, p.blogp2);

    return Scaffold(
      body: Stack(
        children: [
          CustomScrollView(
            controller: _scroll,
            slivers: [
              SliverAppBar(
                pinned: true,
                expandedHeight: 360,
                foregroundColor: Colors.white,
                backgroundColor: pal.bg,
                actions: appBarActions(context),
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      PoolImage(p.img, large: true),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Color(0x66000000), Color(0x22000000), Color(0xDD000000)],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 20,
                        right: 20,
                        bottom: 20,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                for (final c in categoriesOf(p.cate))
                                  ActionChip(
                                    label: Text(c),
                                    backgroundColor: Colors.black38,
                                    labelStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                                    side: const BorderSide(color: Colors.white24),
                                    onPressed: () =>
                                        context.go(Uri(path: '/cate', queryParameters: {'q': c}).toString()),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              p.title.isEmpty ? 'Untitled draft' : p.title,
                              style: t.headlineMedium?.copyWith(color: Colors.white),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Avatar(p.author, size: 44),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        p.author,
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                                      ),
                                      Text(
                                        '${p.date.isEmpty ? 'Not published yet' : p.date} · ${readingTime(p.blogp1, p.blogp2)} min read · $words words'
                                        '${p.featured ? '' : ' · ${compact(p.views)} views'}',
                                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!p.isLive)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Glass(
                            key: const Key('notice'),
                            child: Row(
                              children: [
                                Icon(
                                  p.status == BlogStatus.draft ? Icons.edit_note : Icons.schedule,
                                  color: Brand.violet,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    p.status == BlogStatus.draft
                                        ? 'This is a draft. Only you can see it.'
                                        : 'Scheduled for ${p.publishAt == null ? 'later' : formatWhen(p.publishAt!)}. Only you can see it until then.',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      // Story actions
                      Row(
                        children: [
                          if (!p.featured && p.isLive)
                            ScaleTransition(
                              scale: TweenSequence([
                                TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.35), weight: 1),
                                TweenSequenceItem(tween: Tween(begin: 1.35, end: 1.0), weight: 1),
                              ]).animate(CurvedAnimation(parent: _burst, curve: Curves.easeOut)),
                              child: OutlinedButton.icon(
                                key: const Key('like'),
                                onPressed: _like,
                                style: p.liked
                                    ? OutlinedButton.styleFrom(
                                        foregroundColor: Brand.pink,
                                        side: const BorderSide(color: Brand.pink),
                                      )
                                    : null,
                                icon: Icon(p.liked ? Icons.favorite : Icons.favorite_border),
                                label: Text(compact(p.likes), semanticsLabel: '${p.likes} likes'),
                              ),
                            ),
                          const SizedBox(width: 8),
                          if (p.isLive)
                            IconButton.outlined(
                              tooltip: 'Share this story',
                              onPressed: _share,
                              icon: const Icon(Icons.ios_share),
                            ),
                          if (_isMine) ...[
                            const SizedBox(width: 8),
                            IconButton.outlined(
                              tooltip: 'Edit this story',
                              onPressed: () =>
                                  context.push(Uri(path: '/writeblog', queryParameters: {'id': p.id}).toString()),
                              icon: const Icon(Icons.edit),
                            ),
                            const SizedBox(width: 8),
                            IconButton.outlined(
                              tooltip: 'Delete this story',
                              color: Brand.danger,
                              onPressed: _remove,
                              icon: const Icon(Icons.delete),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 20),
                      SelectableText(
                        p.blogp1,
                        style: t.titleMedium?.copyWith(height: 1.7, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 18),
                      // Sanitized by the API (allowlist); links open in the browser.
                      HtmlWidget(
                        p.blogp2,
                        key: const Key('body'),
                        textStyle: t.bodyLarge?.copyWith(height: 1.8),
                        onTapUrl: (url) async {
                          await openExternal(Uri.parse(url));
                          return true;
                        },
                      ),
                      const SizedBox(height: 28),
                      Center(
                        child: ExcludeSemantics(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              for (var i = 0; i < 3; i++)
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6),
                                  child: Icon(Icons.auto_awesome, size: 14, color: pal.muted),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      Glass(
                        child: Row(
                          children: [
                            Avatar(p.author, size: 56),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Eyebrow('Written by'),
                                  Text(p.author, style: t.titleLarge),
                                  Text('Sharing stories on Bloggerbytes.', style: TextStyle(color: pal.muted)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (related.isNotEmpty) ...[
                const SliverToBoxAdapter(
                  child: SectionHeader(eyebrow: 'Keep reading', title: 'More like this'),
                ),
                SliverToBoxAdapter(
                  child: CardGrid(children: [for (final r in related) PostCard(post: r)]),
                ),
              ],
              const SliverToBoxAdapter(child: SizedBox(height: 48)),
            ],
          ),
          // Reading progress
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: SafeArea(
              bottom: false,
              child: ValueListenableBuilder(
                valueListenable: _progress,
                builder: (_, v, _) => LinearProgressIndicator(
                  value: v,
                  minHeight: 3,
                  backgroundColor: Colors.transparent,
                  color: Brand.brand,
                  semanticsLabel: 'Reading progress',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
