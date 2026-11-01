import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../state/app_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/footer.dart';

String _writeWith(String img) => Uri(path: '/writeblog', queryParameters: {'img': img}).toString();

/// The Image Pool: browse covers, open them full size, and start a story with one.
class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  List<String> _images = const [];
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    AppScope.of(context).posts
        .images()
        .then((list) {
          if (mounted) setState(() => _images = list);
        })
        .catchError((_) {});
  }

  // Root navigator, so it covers the shell's app bar, bottom bar and Write button.
  void _open(int index) => Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black87,
      pageBuilder: (_, _, _) => Lightbox(images: _images, initial: index),
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final pal = Palette.of(context);
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: PageHead(
            eyebrow: 'Image Pool',
            title: 'Every story needs ',
            accent: 'a stunning cover',
            lead:
                '${_images.length} photographs, free to use on Bloggerbytes. Tap one to look closer — or start writing with it.',
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverGrid.builder(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 260,
              mainAxisSpacing: 14,
              crossAxisSpacing: 14,
              childAspectRatio: .78,
            ),
            itemCount: _images.length,
            itemBuilder: (context, i) {
              final name = _images[i];
              return Material(
                color: pal.surface,
                clipBehavior: Clip.antiAlias,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Brand.radius),
                  side: BorderSide(color: pal.border),
                ),
                child: Column(
                  children: [
                    Expanded(
                      child: InkWell(
                        key: Key('pool-$name'),
                        onTap: () => _open(i),
                        child: Semantics(button: true, label: 'View $name', child: PoolImage(name)),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(10, 6, 4, 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Use $name as cover',
                            icon: const Icon(Icons.edit, size: 20, color: Brand.brand),
                            onPressed: () => context.push(_writeWith(name)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        const SliverToBoxAdapter(child: SiteFooter()),
        const SliverToBoxAdapter(child: SizedBox(height: 96)),
      ],
    );
  }
}

/// Full-screen viewer with swipe, prev/next and keyboard arrows.
class Lightbox extends StatefulWidget {
  const Lightbox({super.key, required this.images, required this.initial});

  final List<String> images;
  final int initial;

  @override
  State<Lightbox> createState() => _LightboxState();
}

class _LightboxState extends State<Lightbox> {
  late final _pages = PageController(initialPage: widget.initial);
  late int _index = widget.initial;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _step(int dir) {
    final n = widget.images.length;
    final next = (_index + dir + n) % n;
    // Wrap around instantly at the ends, animate otherwise.
    if ((next - _index).abs() == 1) {
      _pages.animateToPage(next, duration: const Duration(milliseconds: 280), curve: Curves.easeOutCubic);
    } else {
      _pages.jumpToPage(next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.images[_index];
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.escape): () => Navigator.pop(context),
        const SingleActivator(LogicalKeyboardKey.arrowRight): () => _step(1),
        const SingleActivator(LogicalKeyboardKey.arrowLeft): () => _step(-1),
      },
      child: Focus(
        autofocus: true,
        child: Scaffold(
          backgroundColor: Colors.transparent,
          body: SafeArea(
            child: Stack(
              children: [
                PageView.builder(
                  controller: _pages,
                  itemCount: widget.images.length,
                  onPageChanged: (i) => setState(() => _index = i),
                  itemBuilder: (_, i) => InteractiveViewer(
                    child: Center(child: PoolImage(widget.images[i], large: true, fit: BoxFit.contain)),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: IconButton.filledTonal(
                    tooltip: 'Close',
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
                Positioned(
                  left: 8,
                  top: 0,
                  bottom: 80,
                  child: Center(
                    child: IconButton.filledTonal(
                      tooltip: 'Previous',
                      icon: const Icon(Icons.chevron_left),
                      onPressed: () => _step(-1),
                    ),
                  ),
                ),
                Positioned(
                  right: 8,
                  top: 0,
                  bottom: 80,
                  child: Center(
                    child: IconButton.filledTonal(
                      tooltip: 'Next',
                      icon: const Icon(Icons.chevron_right),
                      onPressed: () => _step(1),
                    ),
                  ),
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Glass(
                    padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                    child: Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      runSpacing: 8,
                      children: [
                        Text(
                          '$name · ${_index + 1}/${widget.images.length}',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        FilledButton.icon(
                          onPressed: () {
                            final router = GoRouter.of(context);
                            Navigator.pop(context);
                            router.push(_writeWith(name));
                          },
                          icon: const Icon(Icons.edit),
                          label: const Text('Write with this'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
