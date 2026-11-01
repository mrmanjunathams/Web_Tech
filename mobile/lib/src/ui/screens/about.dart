import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../shell.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/footer.dart';

const _milestones = [
  ('2018', 'The first byte', 'Bloggerbytes launches as a web-technology project: a place for anyone to publish.'),
  ('2019', 'The Image Pool', 'Curated photography so every story gets a cover worth stopping for.'),
  ('2026', 'Reimagined', 'A complete rebuild: instant search, live editor, likes, leaderboard, light and dark.'),
  ('Next', 'Your story', 'The best chapter is the one you are about to write.'),
];

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final pal = Palette.of(context);
    final muted = TextStyle(color: pal.muted, height: 1.6);

    return PageScaffold(
      title: 'About',
      body: ListView(
        children: [
          const PageHead(
            eyebrow: 'About us',
            title: 'We believe sharing beats ',
            accent: 'searching.',
            lead:
                'Bloggerbytes is an all-in-one blogging platform for every kind of writer. We build innovative, beautiful '
                'ways to represent you — so your passions find the readers they deserve.',
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(Brand.radius),
                  child: AspectRatio(
                    aspectRatio: 16 / 10,
                    child: Semantics(
                      label: 'Writing at a desk',
                      image: true,
                      child: const PoolImage('writing-blogs', large: true),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Text('Our mission', style: t.headlineSmall),
                const SizedBox(height: 8),
                Text(
                  'There is a better way to market yourself and express what matters to you: a more valuable, less invasive '
                  'way, where people share information instead of hunting for it. We\'re obsessively passionate about it, and '
                  'our mission is to help people achieve it — across art, science, travel and everything in between.',
                  style: muted,
                ),
                const SizedBox(height: 10),
                Text(
                  'Great blogging is one of the least understood, least transparent crafts on the web. We see that as an '
                  'opportunity, and we\'re excited to make it simple for everyone.',
                  style: muted,
                ),
              ],
            ),
          ),
          const SectionHeader(eyebrow: 'Our journey', title: 'From a student project to a stage for stories'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                for (final (year, title, text) in _milestones)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 56,
                          child: Padding(
                            padding: const EdgeInsets.only(top: 20),
                            child: Text(
                              year,
                              style: const TextStyle(
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w800,
                                color: Brand.brand,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Glass(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(title, style: t.titleMedium),
                                const SizedBox(height: 4),
                                Text(text, style: muted),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 32, 20, 0),
            child: Glass(
              padding: const EdgeInsets.all(28),
              radius: Brand.radiusLg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Say hello', style: t.headlineMedium),
                  const SizedBox(height: 8),
                  Text('Questions, ideas, or a story you want featured? We read everything.', style: muted),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => openExternal(contactUri),
                    icon: const Icon(Icons.mail),
                    label: const Text(contactEmail),
                  ),
                  TextButton.icon(
                    onPressed: () => context.push('/signup'),
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text('or start writing today'),
                  ),
                ],
              ),
            ),
          ),
          const SiteFooter(),
        ],
      ),
    );
  }
}
