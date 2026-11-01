import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/models.dart';
import '../../utils.dart';
import '../theme.dart';
import 'common.dart';

/// Story card used across the app. [hero] is the large magazine-style card.
class PostCard extends StatelessWidget {
  const PostCard({super.key, required this.post, this.hero = false, this.onTap, this.trailing});

  final BlogPost post;
  final bool hero;

  /// Defaults to opening the story. Pass a no-op for previews.
  final VoidCallback? onTap;

  /// Overlay in the top-right corner of the image (e.g. a delete button).
  final Widget? trailing;

  String get _title => post.title.isEmpty ? 'Untitled draft' : post.title;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final t = Theme.of(context).textTheme;
    final cats = categoriesOf(post.cate).take(2);

    return Semantics(
      button: true,
      label: _title,
      child: Material(
        color: p.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Brand.radius),
          side: BorderSide(color: p.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap ?? () => context.push('/post/${Uri.encodeComponent(post.id)}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: hero ? 4 / 3 : 16 / 10,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    PoolImage(post.img, large: hero),
                    Positioned(
                      left: 12,
                      bottom: 12,
                      right: 56,
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if (post.status == BlogStatus.draft)
                            const _StatusChip('Draft', Brand.amber, Color(0xFF1A1205)),
                          if (post.status == BlogStatus.scheduled)
                            _StatusChip(
                              post.publishAt == null ? 'Scheduled' : formatWhen(post.publishAt!),
                              Brand.violet,
                              Colors.white,
                            ),
                          for (final c in cats) _GlassChip(c),
                        ],
                      ),
                    ),
                    if (trailing != null) Positioned(top: 8, right: 8, child: trailing!),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${post.date.isEmpty ? 'Not published' : post.date} · ${readingTime(post.blogp1, post.blogp2)} min read',
                      style: t.labelSmall?.copyWith(color: p.muted, fontWeight: FontWeight.w700, letterSpacing: .8),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: hero ? t.headlineSmall : t.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      post.blogp1,
                      maxLines: hero ? 4 : 3,
                      overflow: TextOverflow.ellipsis,
                      style: t.bodyMedium?.copyWith(color: p.muted),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Avatar(post.author, size: 28),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            post.author,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (post.featured)
                          const _FeaturedChip()
                        else ...[
                          _Stat(
                            Icons.favorite,
                            compact(post.likes),
                            color: post.liked ? Brand.pink : null,
                            label: 'Likes',
                          ),
                          const SizedBox(width: 12),
                          _Stat(Icons.visibility, compact(post.views), label: 'Views'),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.icon, this.value, {this.color, required this.label});

  final IconData icon;
  final String value;
  final Color? color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = color ?? Palette.of(context).muted;
    return Semantics(
      label: '$value $label',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: c),
          const SizedBox(width: 4),
          Text(
            value,
            style: TextStyle(color: c, fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.label, this.background, this.foreground);

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
    child: Text(
      label,
      style: TextStyle(color: foreground, fontSize: 12, fontWeight: FontWeight.w800),
    ),
  );
}

class _GlassChip extends StatelessWidget {
  const _GlassChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: Colors.black.withValues(alpha: .45),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: Colors.white24),
    ),
    child: Text(
      label,
      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
    ),
  );
}

class _FeaturedChip extends StatelessWidget {
  const _FeaturedChip();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(gradient: Brand.gradient, borderRadius: BorderRadius.circular(999)),
    child: const Text(
      'Featured',
      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800),
    ),
  );
}

/// Responsive grid of cards: one column on phones, more on tablets.
class CardGrid extends StatelessWidget {
  const CardGrid({super.key, required this.children, this.padding = const EdgeInsets.symmetric(horizontal: 20)});

  final List<Widget> children;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Padding(
    padding: padding,
    child: LayoutBuilder(
      builder: (context, c) {
        const gap = 16.0;
        final cols = (c.maxWidth / 340).floor().clamp(1, 3);
        final w = (c.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [for (final child in children) SizedBox(width: w, child: child)],
        );
      },
    ),
  );
}

/// Placeholder cards while stories load.
class SkeletonGrid extends StatelessWidget {
  const SkeletonGrid({super.key, this.count = 3});

  final int count;

  @override
  Widget build(BuildContext context) =>
      CardGrid(children: [for (var i = 0; i < count; i++) const Skeleton(height: 340)]);
}
