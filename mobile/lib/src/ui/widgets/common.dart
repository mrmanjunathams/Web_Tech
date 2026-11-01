import 'package:flutter/material.dart';

import '../../utils.dart';
import '../theme.dart';

/// Text painted with the brand gradient (the `.text-grad` class).
class GradientText extends StatelessWidget {
  const GradientText(this.text, {super.key, this.style});

  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) => ShaderMask(
    blendMode: BlendMode.srcIn,
    shaderCallback: (r) => Brand.gradient.createShader(r),
    child: Text(text, style: style),
  );
}

/// Translucent bordered panel (the `.glass` class).
class Glass extends StatelessWidget {
  const Glass({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.radius = Brand.radius});

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: p.border),
      ),
      child: child,
    );
  }
}

/// Small uppercase label above headings.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: Theme.of(context).textTheme.labelMedium
        ?.copyWith(color: color ?? Brand.brand, fontWeight: FontWeight.w800, letterSpacing: 1.6),
  );
}

/// Headline where the trailing part uses the brand gradient: "Featured **stories**".
class SplitHeadline extends StatelessWidget {
  const SplitHeadline(this.plain, this.accent, {super.key, this.style, this.trailing = ''});

  final String plain;
  final String accent;
  final String trailing;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final s = style ?? Theme.of(context).textTheme.headlineMedium;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: plain),
          WidgetSpan(
            alignment: PlaceholderAlignment.baseline,
            baseline: TextBaseline.alphabetic,
            child: GradientText(accent, style: s),
          ),
          if (trailing.isNotEmpty) TextSpan(text: trailing),
        ],
      ),
      style: s,
    );
  }
}

/// Top-of-page header: eyebrow, headline, optional lead paragraph.
class PageHead extends StatelessWidget {
  const PageHead({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.accent,
    this.lead,
    this.after = '',
  });

  final String eyebrow;
  final String title;
  final String accent;
  final String after;
  final String? lead;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Eyebrow(eyebrow),
          const SizedBox(height: 10),
          SplitHeadline(title, accent, trailing: after, style: t.headlineMedium),
          if (lead != null) ...[
            const SizedBox(height: 12),
            Text(lead!, style: t.bodyLarge?.copyWith(color: Palette.of(context).muted)),
          ],
        ],
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.eyebrow, required this.title, this.action, this.onAction});

  final String eyebrow;
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 32, 20, 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(eyebrow),
        const SizedBox(height: 6),
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        if (action != null)
          TextButton.icon(
            onPressed: onAction,
            style: TextButton.styleFrom(padding: EdgeInsets.zero, foregroundColor: Brand.brand),
            iconAlignment: IconAlignment.end,
            icon: const Icon(Icons.arrow_forward, size: 18),
            label: Text(action!, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
      ],
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.text, this.action, this.onAction});

  final IconData icon;
  final String title;
  final String? text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Glass(
    padding: const EdgeInsets.all(28),
    child: SizedBox(
      width: double.infinity,
      child: Column(
        children: [
          Icon(icon, size: 44, color: Brand.brand),
          const SizedBox(height: 12),
          Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
          if (text != null) ...[
            const SizedBox(height: 6),
            Text(
              text!,
              textAlign: TextAlign.center,
              style: TextStyle(color: Palette.of(context).muted),
            ),
          ],
          if (action != null) ...[const SizedBox(height: 16), FilledButton(onPressed: onAction, child: Text(action!))],
        ],
      ),
    ),
  );
}

class ErrorText extends StatelessWidget {
  const ErrorText(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Text(
      message,
      style: const TextStyle(color: Brand.danger, fontWeight: FontWeight.w600),
      semanticsLabel: 'Error: $message',
    ),
  );
}

/// Pulsing placeholder shown while content loads.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 280, this.radius = Brand.radius});

  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    return FadeTransition(
      opacity: Tween(begin: .45, end: 1.0).animate(_c),
      child: Container(
        height: widget.height,
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: BorderRadius.circular(widget.radius),
          border: Border.all(color: p.border),
        ),
      ),
    );
  }
}

/// Number that counts up from 0 when it appears (the `countUp` directive).
class CountUp extends StatelessWidget {
  const CountUp(this.value, {super.key, this.style});

  final int value;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: value.toDouble()),
    duration: const Duration(milliseconds: 1200),
    curve: Curves.easeOutCubic,
    builder: (_, v, _) => Text(compact(v.round()), style: style),
  );
}

/// Gradient initials avatar; colours derive from the name, matching the web app.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 36});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final h = hueOf(name).toDouble();
    return Tooltip(
      message: name,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              HSLColor.fromAHSL(1, h, .75, .55).toColor(),
              HSLColor.fromAHSL(1, (h + 60) % 360, .8, .5).toColor(),
            ],
          ),
        ),
        child: Text(
          initials(name),
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: size * .38, height: 1),
        ),
      ),
    );
  }
}

/// Image Pool picture, with a gradient fallback for unknown names.
class PoolImage extends StatelessWidget {
  const PoolImage(this.img, {super.key, this.large = false, this.fit = BoxFit.cover});

  final String img;
  final bool large;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) => Image.asset(
    imageAsset(img, large: large),
    fit: fit,
    width: double.infinity,
    height: double.infinity,
    gaplessPlayback: true,
    errorBuilder: (_, _, _) => const DecoratedBox(decoration: BoxDecoration(gradient: Brand.gradient)),
  );
}

/// The Bloggerbytes logo. The artwork is dark, so dark theme inverts it and rotates the hue back
/// (the web's `filter: invert(1) hue-rotate(180deg)`).
class Logo extends StatelessWidget {
  const Logo({super.key, this.height = 40});

  final double height;

  static const _darkFilter = ColorFilter.matrix([
    0.574, -1.430, -0.144, 0, 255, //
    -0.426, -0.430, -0.144, 0, 255, //
    -0.426, -1.430, 0.856, 0, 255, //
    0, 0, 0, 1, 0, //
  ]);

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(
      'assets/images/logo-transparent.png',
      height: height,
      alignment: Alignment.centerLeft,
      semanticLabel: 'Bloggerbytes — publish your passions',
    );
    return Theme.of(context).brightness == Brightness.dark
        ? ColorFiltered(colorFilter: _darkFilter, child: image)
        : image;
  }
}

/// Chips row that wraps.
class ChipWrap extends StatelessWidget {
  const ChipWrap({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: children);
}
