import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/models.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/footer.dart';
import '../widgets/live_data.dart';
import '../widgets/post_card.dart';

// Gold, silver, bronze. Icons rather than emoji: Flutter web has no emoji font by default.
const _medals = [Color(0xFFFFC233), Color(0xFFC9CED6), Color(0xFFD8894B)];
const _badges = [
  (Icons.edit, 'First Draft', 'Publish your first story.', 178.0),
  (Icons.local_fire_department, 'On Fire', 'Publish five stories.', 20.0),
  (Icons.favorite, 'Crowd Pleaser', 'Collect 25 likes across your stories.', 335.0),
  (Icons.visibility, 'Page Turner', 'Reach 500 views.', 255.0),
  (Icons.workspace_premium, 'Legend', 'Finish a month at #1.', 45.0),
];

/// Writers ranked by likes received, plus the badges they can earn (the web's /rewards page).
class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> with LiveData {
  List<Leader> _leaders = const [];
  bool _loading = true;

  @override
  Future<void> reload({required bool initial}) async {
    try {
      final rows = await AppScope.of(context).posts.leaderboard();
      if (mounted) setState(() => _leaders = rows);
    } catch (_) {
      // Shows the empty podium.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = AppScope.of(context).auth.user?.username;
    final t = Theme.of(context).textTheme;
    final pal = Palette.of(context);
    // Display order puts #1 in the middle.
    final podium = [
      if (_leaders.length > 1) _leaders[1],
      if (_leaders.isNotEmpty) _leaders[0],
      if (_leaders.length > 2) _leaders[2],
    ];

    return RefreshIndicator(
      onRefresh: () => reload(initial: false),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          const PageHead(
            eyebrow: 'Rewards',
            title: 'The ',
            accent: 'leaderboard',
            lead: 'Writers ranked by the love their stories receive. Every like moves you up.',
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _loading
                ? const Skeleton(height: 260)
                : _leaders.isEmpty
                ? EmptyState(
                    icon: Icons.emoji_events,
                    title: 'The podium is empty',
                    text: 'Publish a story and claim the first spot.',
                    action: 'Write now',
                    onAction: () => context.push('/writeblog'),
                  )
                : Column(
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          for (final l in podium)
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: _PodiumPlace(l),
                              ),
                            ),
                        ],
                      ),
                      if (_leaders.length > 3) ...[
                        const SizedBox(height: 16),
                        Glass(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          // Rows paint their highlight and ripple on this (transparent) Material, above the panel.
                          child: Material(
                            type: MaterialType.transparency,
                            child: Column(
                              children: [
                                for (final l in _leaders.skip(3))
                                  ListTile(
                                    tileColor: l.username == me ? Brand.brand.withValues(alpha: .12) : null,
                                    leading: SizedBox(
                                      width: 84,
                                      child: Row(
                                        children: [
                                          SizedBox(
                                            width: 36,
                                            child: Text(
                                              '#${l.rank}',
                                              style: TextStyle(color: pal.muted, fontFamily: 'monospace'),
                                            ),
                                          ),
                                          Avatar(l.displayName, size: 36),
                                        ],
                                      ),
                                    ),
                                    title: Text(l.displayName, style: const TextStyle(fontWeight: FontWeight.w800)),
                                    subtitle: Text(
                                      '@${l.username} · ${l.posts} stories',
                                      style: TextStyle(color: pal.muted),
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.favorite, color: Brand.pink, size: 18),
                                        const SizedBox(width: 4),
                                        Text(compact(l.likes), style: const TextStyle(fontWeight: FontWeight.w800)),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
          ),
          const SectionHeader(eyebrow: 'Badges', title: 'Milestones worth chasing'),
          CardGrid(
            children: [
              for (final (icon, name, rule, hue) in _badges)
                Glass(
                  child: Row(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          gradient: LinearGradient(
                            colors: [
                              HSLColor.fromAHSL(1, hue, .8, .55).toColor(),
                              HSLColor.fromAHSL(1, (hue + 40) % 360, .85, .45).toColor(),
                            ],
                          ),
                        ),
                        child: Icon(icon, color: Colors.white),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: t.titleMedium),
                            Text(rule, style: TextStyle(color: pal.muted)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SiteFooter(),
        ],
      ),
    );
  }
}

class _PodiumPlace extends StatelessWidget {
  const _PodiumPlace(this.l);

  final Leader l;

  @override
  Widget build(BuildContext context) {
    final first = l.rank == 1;
    return Glass(
      padding: EdgeInsets.fromLTRB(8, first ? 24 : 16, 8, 16),
      child: Column(
        children: [
          Icon(Icons.emoji_events, size: 34, color: _medals[l.rank - 1], semanticLabel: 'Rank ${l.rank}'),
          const SizedBox(height: 6),
          Avatar(l.displayName, size: first ? 72 : 56),
          const SizedBox(height: 8),
          Text(
            l.displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          Text(
            '@${l.username}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: Palette.of(context).muted, fontSize: 12),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.favorite, color: Brand.pink, size: 16),
              const SizedBox(width: 4),
              Text(compact(l.likes), style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          Text(
            '${l.posts} ${l.posts == 1 ? 'story' : 'stories'} · ${compact(l.views)} views',
            textAlign: TextAlign.center,
            style: TextStyle(color: Palette.of(context).muted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
