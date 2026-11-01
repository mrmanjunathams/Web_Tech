import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/models.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../theme.dart';
import '../widgets/command_palette.dart';
import '../widgets/common.dart';
import '../widgets/footer.dart';
import '../widgets/live_data.dart';
import '../widgets/post_card.dart';

const _words = ['your way.', 'out loud.', 'beautifully.', 'fearlessly.'];
const _baseTopics = ['Travel', 'Art', 'Ocean', 'TechByte', 'Nature', 'Fashion', 'Office', 'Animals'];
const _heroCards = ['img11', 'img5', 'img9'];
const _features = [
  (Icons.bolt, 'Publish in minutes', 'A focused editor with live preview and auto-saved drafts.'),
  (Icons.travel_explore, 'Instant search', 'Tap search anywhere to jump to any story, page or action.'),
  (Icons.photo_library, 'Image Pool', 'Hand-picked photography, ready for your next cover.'),
  (Icons.military_tech, 'Climb the leaderboard', 'Every like counts. The best writers rise to the top.'),
  (Icons.contrast, 'Light & dark', 'A reading experience that adapts to you, day or night.'),
];

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with LiveData {
  Stats? _stats;
  List<BlogPost> _stories = const [];
  bool _loading = true;
  int _word = 0;
  late final Timer _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(
      const Duration(milliseconds: 2600),
      (_) => setState(() => _word = (_word + 1) % _words.length),
    );
  }

  @override
  Future<void> reload({required bool initial}) async {
    final posts = AppScope.of(context).posts;
    try {
      final (stats, stories) = await (posts.stats(), posts.all()).wait;
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _stories = stories;
      });
    } catch (_) {
      // Home still renders without live numbers.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  /// Most-loved stories first (likes, then views), falling back to the newest.
  List<BlogPost> get _trending =>
      ([..._stories]..sort((a, b) => b.likes != a.likes ? b.likes - a.likes : b.views - a.views)).take(3).toList();

  List<String> get _topics => {for (final s in _stories) ...categoriesOf(s.cate), ..._baseTopics}.toList();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final p = Palette.of(context);
    final signedIn = AppScope.of(context).auth.user != null;
    final writePath = signedIn ? '/writeblog' : '/signup';

    return RefreshIndicator(
      onRefresh: () => reload(initial: false),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          // Hero
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Glass(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  radius: 999,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(color: Brand.brand, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          '${_stats?.writers ?? 0} writers · ${_stats?.blogs ?? 0} stories and counting',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: t.labelMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Text('Publish your passions,', style: t.displaySmall),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 450),
                  transitionBuilder: (child, a) => FadeTransition(
                    opacity: a,
                    child: SlideTransition(
                      position: Tween(begin: const Offset(0, .3), end: Offset.zero).animate(a),
                      child: child,
                    ),
                  ),
                  child: Semantics(
                    liveRegion: true,
                    child: GradientText(_words[_word], key: ValueKey(_word), style: t.displaySmall),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Bloggerbytes is a home for writers who care how their words look. Create a stunning story in minutes, '
                  'pick a cover from our Image Pool, and let readers fall in love.',
                  style: t.bodyLarge?.copyWith(color: p.muted),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    FilledButton.icon(
                      onPressed: () => context.push(writePath),
                      icon: const Icon(Icons.edit_square),
                      label: Text(signedIn ? 'Write a story' : 'Start writing — free'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.go('/cate'),
                      icon: const Icon(Icons.explore),
                      label: const Text('Explore stories'),
                    ),
                  ],
                ),
                TextButton.icon(
                  onPressed: () => showCommandPalette(context),
                  icon: const Icon(Icons.search, size: 18),
                  label: const Text('Search anything'),
                  style: TextButton.styleFrom(foregroundColor: p.muted, padding: EdgeInsets.zero),
                ),
              ],
            ),
          ),
          const _HeroStack(),
          // Topics marquee
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              itemCount: _topics.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => ActionChip(
                label: Text(_topics[i]),
                avatar: const Icon(Icons.auto_awesome, size: 14, color: Brand.brand),
                onPressed: () => context.go(Uri(path: '/cate', queryParameters: {'q': _topics[i]}).toString()),
              ),
            ),
          ),
          // Stats band
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: Glass(
              child: GridView(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisExtent: 92),
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _Stat(_stats?.blogs ?? 0, 'Stories published'),
                  _Stat(_stats?.writers ?? 0, 'Writers'),
                  _Stat(_stats?.categories ?? 0, 'Topics'),
                  _Stat(_stats?.likes ?? 0, 'Likes given'),
                ],
              ),
            ),
          ),
          SectionHeader(
            eyebrow: 'Trending now',
            title: "Stories readers can't put down",
            action: 'See all stories',
            onAction: () => context.go('/cate'),
          ),
          if (_loading)
            const SkeletonGrid()
          else if (_trending.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: EmptyState(
                icon: Icons.draw,
                title: 'No stories yet',
                text: 'Be the first to write one.',
                action: 'Write a story',
                onAction: () => context.push('/writeblog'),
              ),
            )
          else
            CardGrid(children: [for (final s in _trending) PostCard(post: s)]),
          const SectionHeader(eyebrow: 'Why Bloggerbytes', title: "Everything a writer needs. Nothing they don't."),
          CardGrid(
            children: [
              for (final (icon, title, text) in _features)
                Glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(gradient: Brand.gradient, borderRadius: BorderRadius.circular(14)),
                        child: Icon(icon, color: Colors.white),
                      ),
                      const SizedBox(height: 14),
                      Text(title, style: t.titleMedium),
                      const SizedBox(height: 4),
                      Text(text, style: TextStyle(color: p.muted)),
                    ],
                  ),
                ),
            ],
          ),
          // CTA panel
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 40, 20, 0),
            child: _CtaPanel(
              eyebrow: 'Your turn',
              title: 'Every great story starts with ',
              accent: 'one sentence.',
              lead: 'Join a community of writers sharing travel, art, tech and everything between.',
              action: 'Write yours now',
              onAction: () => context.push(writePath),
            ),
          ),
          const SiteFooter(),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.value, this.label);

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      FittedBox(
        child: CountUp(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Brand.brand)),
      ),
      Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: Palette.of(context).muted, fontWeight: FontWeight.w600),
      ),
    ],
  );
}

/// Decorative fanned stack of covers.
class _HeroStack extends StatelessWidget {
  const _HeroStack();

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      height: 230,
      child: Stack(
        alignment: Alignment.center,
        children: [
          for (final (i, img) in _heroCards.indexed)
            Transform.translate(
              offset: Offset((i - 1) * 90.0, i == 1 ? -8 : 10),
              child: Transform.rotate(
                angle: (i - 1) * .12,
                child: Container(
                  width: 150,
                  height: 190,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(Brand.radius),
                    border: Border.all(color: Palette.of(context).border, width: 4),
                    boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 30, offset: Offset(0, 14))],
                  ),
                  child: PoolImage(img),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _CtaPanel extends StatelessWidget {
  const _CtaPanel({
    required this.eyebrow,
    required this.title,
    required this.accent,
    required this.lead,
    required this.action,
    required this.onAction,
  });

  final String eyebrow;
  final String title;
  final String accent;
  final String lead;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(28),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(Brand.radiusLg),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Brand.violet.withValues(alpha: .28),
          Brand.brand.withValues(alpha: .16),
          Brand.pink.withValues(alpha: .22),
        ],
      ),
      border: Border.all(color: Palette.of(context).border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(eyebrow),
        const SizedBox(height: 8),
        SplitHeadline(title, accent, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 10),
        Text(lead, style: TextStyle(color: Palette.of(context).muted)),
        const SizedBox(height: 18),
        FilledButton.icon(
          onPressed: onAction,
          iconAlignment: IconAlignment.end,
          icon: const Icon(Icons.arrow_forward),
          label: Text(action),
        ),
      ],
    ),
  );
}
