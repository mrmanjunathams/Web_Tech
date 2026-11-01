import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../rich_text.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/footer.dart';
import '../widgets/live_data.dart';
import '../widgets/post_card.dart';

enum StorySort {
  newest('Newest'),
  loved('Most loved'),
  viewed('Most viewed'),
  az('A → Z');

  const StorySort(this.label);
  final String label;
}

/// Topic counts across [blogs], most used first (ties alphabetical).
List<({String name, int count})> topicCounts(List<BlogPost> blogs) {
  final counts = <String, int>{};
  for (final b in blogs) {
    for (final c in categoriesOf(b.cate)) {
      counts[c] = (counts[c] ?? 0) + 1;
    }
  }
  return [for (final e in counts.entries) (name: e.key, count: e.value)]
    ..sort((a, b) => a.count != b.count ? b.count - a.count : a.name.compareTo(b.name));
}

/// Stories matching [query] (title, writer, topic, date or text), in [sort] order.
List<BlogPost> filterStories(List<BlogPost> blogs, String query, StorySort sort) {
  final q = query.trim().toLowerCase();
  final list = q.isEmpty
      ? [...blogs]
      : blogs
            .where(
              (b) => [
                b.cate,
                b.title,
                b.auth,
                b.authName,
                b.date,
                b.blogp1,
                textOf(b.blogp2),
              ].any((v) => v.toLowerCase().contains(q)),
            )
            .toList();
  switch (sort) {
    case StorySort.loved:
      list.sort((a, b) => a.likes != b.likes ? b.likes - a.likes : b.views - a.views);
    case StorySort.viewed:
      list.sort((a, b) => b.views - a.views);
    case StorySort.az:
      list.sort((a, b) => a.title.compareTo(b.title));
    case StorySort.newest:
      break; // the API already returns newest first
  }
  return list;
}

/// "Explore": every community story with search, topic chips and sorting. Other screens link here with ?q=topic.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key, this.query = ''});

  final String query;

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> with LiveData {
  late final _search = TextEditingController(text: widget.query);
  List<BlogPost> _blogs = const [];
  bool _loading = true;
  String _error = '';
  StorySort _sort = StorySort.newest;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(ExploreScreen old) {
    super.didUpdateWidget(old);
    if (old.query != widget.query) _search.text = widget.query;
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Future<void> reload({required bool initial}) async {
    try {
      final blogs = await AppScope.of(context).posts.all();
      if (mounted) {
        setState(() {
          _blogs = blogs;
          _error = '';
        });
      }
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Could not load stories.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setQuery(String q) => _search.text = q;

  @override
  Widget build(BuildContext context) {
    final q = _search.text;
    final filtered = filterStories(_blogs, q, _sort);
    final topics = topicCounts(_blogs);

    return RefreshIndicator(
      onRefresh: () => reload(initial: false),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 96),
        children: [
          const PageHead(eyebrow: 'Explore', title: 'Find your next ', accent: 'favourite read'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('explore-search'),
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Search titles, writers, topics…',
                      suffixIcon: q.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Clear search',
                              icon: const Icon(Icons.close),
                              onPressed: () => _setQuery(''),
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                PopupMenuButton<StorySort>(
                  tooltip: 'Sort stories',
                  initialValue: _sort,
                  onSelected: (s) => setState(() => _sort = s),
                  itemBuilder: (_) => [for (final s in StorySort.values) PopupMenuItem(value: s, child: Text(s.label))],
                  child: Glass(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                    radius: Brand.radiusSm,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.sort, size: 20),
                        const SizedBox(width: 6),
                        Text(_sort.label, style: const TextStyle(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                FilterChip(label: const Text('All'), selected: q.isEmpty, onSelected: (_) => _setQuery('')),
                for (final topic in topics)
                  Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: FilterChip(
                      label: Text('${topic.name}  ${topic.count}'),
                      selected: q.toLowerCase() == topic.name.toLowerCase(),
                      onSelected: (_) => _setQuery(topic.name),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: _error.isNotEmpty
                ? ErrorText(_error)
                : Text(
                    _loading
                        ? ''
                        : '${filtered.length} ${filtered.length == 1 ? 'story' : 'stories'}${q.isNotEmpty ? ' for "$q"' : ''}',
                    key: const Key('result-count'),
                    style: TextStyle(color: Palette.of(context).muted),
                  ),
          ),
          if (_loading)
            const SkeletonGrid(count: 6)
          else if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: EmptyState(
                icon: Icons.search_off,
                title: 'No stories match "$q"',
                text: 'Try another topic — or write the story you were looking for.',
                action: 'Write it',
                onAction: () => context.push('/writeblog'),
              ),
            )
          else
            CardGrid(children: [for (final b in filtered) PostCard(post: b)]),
          const SiteFooter(),
        ],
      ),
    );
  }
}
