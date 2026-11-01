import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../state/app_scope.dart';
import '../widgets/common.dart';
import '../widgets/footer.dart';
import '../widgets/live_data.dart';
import '../widgets/post_card.dart';

/// Editor's picks (featured blogs) plus the latest community posts (the web's /blog page).
class StoriesScreen extends StatefulWidget {
  const StoriesScreen({super.key});

  @override
  State<StoriesScreen> createState() => _StoriesScreenState();
}

class _StoriesScreenState extends State<StoriesScreen> with LiveData {
  List<BlogPost> _featured = const [];
  List<BlogPost> _community = const [];
  bool _loading = true;
  String _error = '';

  @override
  Future<void> reload({required bool initial}) async {
    final posts = AppScope.of(context).posts;
    try {
      final [featured, community] = await Future.wait([posts.featured(), posts.all()]);
      if (!mounted) return;
      setState(() {
        _featured = featured;
        _community = community;
        _error = '';
      });
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Could not load stories.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final latest = _community.take(6).toList();
    return RefreshIndicator(
      onRefresh: () => reload(initial: false),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          const PageHead(
            eyebrow: "Editor's picks",
            title: 'Featured ',
            accent: 'stories',
            lead: 'Hand-picked reads from across Bloggerbytes, plus the freshest posts from our community.',
          ),
          if (_error.isNotEmpty) Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: ErrorText(_error)),
          if (_loading)
            const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Skeleton(height: 420))
          else ...[
            if (_featured.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: PostCard(post: _featured.first, hero: true),
              ),
            if (_featured.length > 1) ...[
              const SizedBox(height: 16),
              CardGrid(children: [for (final p in _featured.skip(1).take(2)) PostCard(post: p)]),
            ],
          ],
          SectionHeader(
            eyebrow: 'Fresh from the community',
            title: 'Latest posts',
            action: 'Explore everything',
            onAction: () => context.go('/cate'),
          ),
          if (latest.isNotEmpty)
            CardGrid(children: [for (final p in latest) PostCard(post: p)])
          else if (!_loading)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: EmptyState(
                icon: Icons.draw,
                title: 'Nothing here yet',
                action: 'Write the first post',
                onAction: () => context.push('/writeblog'),
              ),
            ),
          const SiteFooter(),
        ],
      ),
    );
  }
}
