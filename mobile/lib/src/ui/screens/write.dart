import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:go_router/go_router.dart';

import '../../api/api_client.dart';
import '../../api/models.dart';
import '../../rich_text.dart';
import '../../router.dart';
import '../../state/app_scope.dart';
import '../../state/storage.dart';
import '../../utils.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/feedback.dart';
import '../widgets/post_card.dart';
import '../widgets/rich_editor.dart';
import 'explore.dart' show topicCounts;

/// Server drafts are saved this long after the last change.
const autosaveDelay = Duration(seconds: 2);

/// Adds [topic] to a "A | B" category string, or removes it if present (case-insensitive).
String toggleTopic(String cate, String topic) {
  final list = categoriesOf(cate);
  final i = list.indexWhere((c) => c.toLowerCase() == topic.toLowerCase());
  i >= 0 ? list.removeAt(i) : list.add(topic);
  return list.join(' | ');
}

enum _Busy { none, saving, publishing }

/// The studio: write with a rich-text editor, save drafts, publish now or schedule, and edit stories later
/// (`/writeblog?id=…`). New stories can start from the Image Pool (`/writeblog?img=…`).
class WriteScreen extends StatefulWidget {
  const WriteScreen({super.key, this.id, this.initialImage});

  /// Story to edit (one of yours).
  final String? id;

  /// Cover to start with.
  final String? initialImage;

  @override
  State<WriteScreen> createState() => WriteScreenState();
}

class WriteScreenState extends State<WriteScreen> {
  final _title = TextEditingController();
  final _blogp1 = TextEditingController();
  final _topic = TextEditingController();
  String _cate = '';
  String _img = '';
  String _blogp2 = '';

  /// Body to load into the editor (changes only when content is replaced from outside).
  String _editorSeed = '';

  BlogPost? _saved;
  Draft _baseline = const Draft();
  String _localCopy = '';
  bool _loadingStory = false;
  _Busy _busy = _Busy.none;
  String _error = '';
  DateTime? _savedAt;
  bool _preview = false;
  List<String> _images = const [];
  List<String> _suggestions = const [];
  Timer? _timer;
  bool _started = false;
  late final AppServices _services;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _services = AppScope.of(context);
    if (widget.id != null) {
      _open(widget.id!);
    } else {
      _restoreLocal();
    }
    if (widget.initialImage case final img? when img.isNotEmpty) _img = img;
    for (final c in [_title, _blogp1]) {
      c.addListener(_changed);
    }
    _services.posts.images().then((list) {
      if (mounted) setState(() => _images = list);
    }, onError: (_) {});
    _services.posts.all().then((all) {
      if (mounted) setState(() => _suggestions = topicCounts(all).take(12).map((t) => t.name).toList());
    }, onError: (_) {});
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (final c in [_title, _blogp1, _topic]) {
      c.dispose();
    }
    super.dispose();
  }

  // ---- state ----

  Draft get _fields => Draft(title: _title.text, cate: _cate, img: _img, blogp1: _blogp1.text, blogp2: _blogp2);

  static String _key(Draft d) => [d.title, d.cate, d.img, d.blogp1, d.blogp2].join('\u0000');

  bool get _dirty => _key(_fields) != _key(_baseline);

  /// Changes not saved anywhere yet (drives the status text).
  bool get _unsaved => _dirty && (_saved != null || _key(_fields) != _localCopy);

  BlogStatus? get _status => _saved?.status;

  /// Drafts (and stories not yet saved) save themselves; live and scheduled stories change only on "Update".
  bool get _autosaves => _saved == null || _status == BlogStatus.draft;

  bool get _hasContent => _title.text.trim().isNotEmpty || _blogp1.text.trim().isNotEmpty || _blogp2.isNotEmpty;

  List<String> get _topics => categoriesOf(_cate);

  List<(String, bool)> get _checks => [
    ('A headline', _title.text.trim().isNotEmpty),
    ('At least one topic', _topics.isNotEmpty),
    ('A cover image', _img.isNotEmpty),
    ('An opening paragraph', _blogp1.text.trim().isNotEmpty),
    ('Your story', textOf(_blogp2).trim().isNotEmpty),
  ];

  bool get _ready => _checks.every((c) => c.$2);

  String get _author => _services.auth.user?.displayName ?? 'you';

  BlogPost get _previewPost => BlogPost(
    id: _saved?.id ?? 'preview',
    auth: _services.auth.user?.username ?? 'you',
    authName: _author,
    title: _title.text.isNotEmpty ? _title.text : 'Your headline goes here',
    cate: _cate.isNotEmpty ? _cate : 'Topic',
    date: _saved?.date ?? '',
    img: _img.isNotEmpty ? _img : 'img20',
    blogp1: _blogp1.text.isNotEmpty ? _blogp1.text : 'Your opening paragraph appears on story cards…',
    blogp2: _blogp2,
  );

  void _setFields(Draft d) {
    _title.text = d.title;
    _blogp1.text = d.blogp1;
    _cate = d.cate;
    _img = d.img;
    _blogp2 = d.blogp2;
    _editorSeed = d.blogp2;
    _baseline = d;
  }

  /// Re-renders and schedules the autosave.
  void _changed() {
    if (!mounted) return;
    setState(() {});
    if (!_dirty || !_autosaves || _loadingStory) return;
    _timer?.cancel();
    final fields = _fields;
    _timer = Timer(autosaveDelay, () => _saved != null ? saveDraft(quiet: true) : _saveLocal(fields));
  }

  void _setCate(String cate) {
    _cate = cate;
    _changed();
  }

  void _setImg(String img) {
    _img = img;
    _changed();
  }

  // ---- loading and saving ----

  Future<void> _open(String id) async {
    setState(() => _loadingStory = true);
    try {
      final story = await _services.posts.get(id);
      if (story.auth != _services.auth.user?.username) throw StateError('not yours');
      _setFields(
        Draft(title: story.title, cate: story.cate, img: story.img, blogp1: story.blogp1, blogp2: story.blogp2),
      );
      _saved = story;
    } catch (_) {
      showToast("That story can't be edited.", ToastKind.error);
      if (mounted) context.go('/myacc');
    } finally {
      if (mounted) setState(() => _loadingStory = false);
    }
  }

  void _restoreLocal() {
    final d = _services.drafts.load();
    if (d != null) _setFields(d);
    _baseline = const Draft();
  }

  void _saveLocal(Draft fields) {
    if (!_hasContent) return;
    _services.drafts.save(fields);
    if (mounted) {
      setState(() {
        _localCopy = _key(fields);
        _savedAt = DateTime.now();
      });
    }
  }

  /// Saves as a draft on the server (creating it the first time). [quiet] = autosave, no toast.
  Future<void> saveDraft({bool quiet = false}) async {
    if (_busy != _Busy.none || !_hasContent) return;
    if (_saved != null && !_dirty && _status == BlogStatus.draft) return;
    await _save(_input(status: 'draft'), quiet ? '' : 'Draft saved. Finish it whenever you like.', _Busy.saving);
  }

  BlogInput _input({String? status, DateTime? publishAt, bool publishNow = false}) {
    final f = _fields;
    return BlogInput(
      title: f.title,
      cate: f.cate,
      img: f.img,
      blogp1: f.blogp1,
      blogp2: f.blogp2,
      status: status,
      publishAt: publishAt,
      publishNow: publishNow,
    );
  }

  /// Publishes now, or at [at] (a future time).
  Future<void> publish({DateTime? at}) async {
    if (_busy != _Busy.none || !_ready) return;
    final story = await _save(
      _input(status: 'published', publishAt: at, publishNow: at == null),
      at == null ? 'Your story is live!' : 'Scheduled for ${formatWhen(at)}.',
      _Busy.publishing,
    );
    if (story == null || !mounted) return;
    resetTo(context, story.isLive ? '/post/${Uri.encodeComponent(story.id)}' : '/myacc');
  }

  /// Saves changes to a live or scheduled story without changing its status.
  Future<void> update() async {
    if (_busy != _Busy.none || !_ready) return;
    await _save(_input(), 'Changes saved.', _Busy.saving);
  }

  Future<void> _unpublish() async {
    final ok = await confirmDialog(
      context,
      title: 'Move to drafts?',
      text: 'Readers will no longer see this story until you publish it again.',
      okLabel: 'Move to drafts',
    );
    if (ok) await _save(_input(status: 'draft'), 'Moved to your drafts.', _Busy.saving);
  }

  /// Deletes the story (or just clears the device draft, if it was never saved).
  Future<void> _discard() async {
    final story = _saved;
    final ok = await confirmDialog(
      context,
      title: story != null ? 'Delete this story?' : 'Clear this draft?',
      text: story != null
          ? '"${_title.text.isEmpty ? 'Untitled' : _title.text}" will be gone for good.'
          : 'Everything you have written here will be cleared.',
      okLabel: story != null ? 'Delete' : 'Clear',
      danger: true,
    );
    if (!ok || !mounted) return;
    _timer?.cancel();
    if (story == null) {
      await _services.drafts.clear();
      setState(() {
        _setFields(const Draft());
        _savedAt = null;
      });
      return;
    }
    try {
      await _services.posts.remove(story.id);
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this story.'), ToastKind.error);
      return;
    }
    _baseline = _fields; // nothing left to lose
    await _services.auth.load();
    showToast('Story deleted.', ToastKind.success);
    if (mounted) context.go('/myacc');
  }

  Future<BlogPost?> _save(BlogInput input, String message, _Busy kind) async {
    _timer?.cancel();
    setState(() {
      _busy = kind;
      _error = '';
    });
    final sent = _fields;
    try {
      final current = _saved;
      final story = current != null
          ? await _services.posts.update(current.id, input)
          : await _services.posts.create(input);
      _saved = story;
      _baseline = sent;
      _savedAt = DateTime.now();
      if (current == null) await _services.drafts.clear();
      if (message.isNotEmpty) showToast(message, ToastKind.success);
      unawaited(_services.auth.load());
      return story;
    } on ApiException catch (err) {
      if (err.status == 401) {
        showToast('Your session ended. Sign in again; your draft is kept on this device.', ToastKind.error);
        await _services.drafts.save(sent);
        _baseline = sent;
        if (mounted) context.push('/login');
        return null;
      }
      _error = errorMessage(err, 'Could not save your story. Please try again.');
      return null;
    } finally {
      if (mounted) setState(() => _busy = _Busy.none);
    }
  }

  /// Picks a future date and time; null when cancelled or in the past.
  Future<DateTime?> _pickSchedule() async {
    final now = DateTime.now();
    final current = _saved?.publishAt;
    final initial = current != null && current.isAfter(now) ? current.toLocal() : now.add(const Duration(days: 1));
    final day = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 365)),
      helpText: 'Publish on',
    );
    if (day == null || !mounted) return null;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial), helpText: 'At');
    if (time == null) return null;
    final at = DateTime(day.year, day.month, day.day, time.hour, time.minute);
    if (!at.isAfter(DateTime.now())) {
      setState(() => _error = 'Pick a time in the future to schedule your story.');
      return null;
    }
    return at;
  }

  Future<void> _schedule() async {
    final at = await _pickSchedule();
    if (at != null) await publish(at: at);
  }

  /// Before leaving: pending draft changes are saved first; unsaved edits to a live or scheduled story need
  /// confirmation. Returns whether leaving is fine.
  Future<bool> canLeave() async {
    if (!_dirty || _busy != _Busy.none) return true;
    _timer?.cancel();
    if (_saved == null) {
      _saveLocal(_fields);
      return true;
    }
    if (_autosaves) {
      await saveDraft(quiet: true);
      return true;
    }
    return confirmDialog(
      context,
      title: 'Leave without saving?',
      text: 'Your latest changes to this story have not been saved.',
      okLabel: 'Leave',
      danger: true,
    );
  }

  // ---- UI ----

  void _addTopic() {
    final t = _topic.text.replaceAll(RegExp(r'[|\s]+'), ' ').trim(); // "|" separates topics
    if (t.isNotEmpty && !_topics.any((c) => c.toLowerCase() == t.toLowerCase())) _setCate([..._topics, t].join(' | '));
    _topic.clear();
  }

  Future<void> _chooseCover() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SizedBox(
        height: MediaQuery.sizeOf(ctx).height * .7,
        child: Column(
          children: [
            Text('Choose a cover', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 12),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.all(16),
                gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                  maxCrossAxisExtent: 180,
                  mainAxisSpacing: 10,
                  crossAxisSpacing: 10,
                  childAspectRatio: 4 / 3,
                ),
                itemCount: _images.length,
                itemBuilder: (_, i) => InkWell(
                  key: Key('cover-${_images[i]}'),
                  onTap: () => Navigator.pop(ctx, _images[i]),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(Brand.radiusSm),
                    child: Semantics(label: _images[i], selected: _img == _images[i], child: PoolImage(_images[i])),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (picked != null) _setImg(picked);
  }

  String get _statusLabel => switch (_status) {
    null => 'New story',
    BlogStatus.draft => 'Draft',
    BlogStatus.scheduled => 'Scheduled · ${formatWhen(_saved!.publishAt!)}',
    BlogStatus.published => 'Published',
  };

  String get _saveLabel {
    if (_busy == _Busy.saving) return 'Saving…';
    if (_unsaved) return _autosaves ? 'Editing…' : 'Unsaved changes';
    final at = _savedAt;
    if (at == null) return '';
    final time = TimeOfDay.fromDateTime(at).format(context);
    return _saved != null ? 'Saved $time' : 'Saved on this device $time';
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    final pal = Palette.of(context);
    final words = storyWords(_blogp1.text, _blogp2);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final router = GoRouter.of(context);
        if (await canLeave() && mounted) router.pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _statusLabel,
                key: const Key('status'),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
              ),
              Text(
                [
                  _saveLabel,
                  '$words words · ${readingTime(_blogp1.text, _blogp2)} min',
                ].where((s) => s.isNotEmpty).join(' · '),
                key: const Key('save-state'),
                style: TextStyle(color: pal.muted, fontSize: 12),
              ),
            ],
          ),
          actions: [
            IconButton(
              tooltip: _preview ? 'Edit' : 'Preview',
              icon: Icon(_preview ? Icons.edit : Icons.visibility),
              onPressed: () => setState(() => _preview = !_preview),
            ),
            if (_autosaves)
              FilledButton(
                key: const Key('publish'),
                onPressed: _ready && _busy == _Busy.none ? publish : null,
                child: Text(_busy == _Busy.publishing ? 'Publishing…' : 'Publish'),
              )
            else
              FilledButton(
                key: const Key('update'),
                onPressed: _ready && _dirty && _busy == _Busy.none ? update : null,
                child: Text(_busy == _Busy.saving ? 'Saving…' : 'Update'),
              ),
            PopupMenuButton<String>(
              key: const Key('studio-menu'),
              tooltip: 'More',
              onSelected: (v) => switch (v) {
                'draft' => saveDraft(),
                'schedule' => _schedule(),
                'unpublish' => _unpublish(),
                _ => _discard(),
              },
              itemBuilder: (_) => [
                if (_autosaves)
                  PopupMenuItem(
                    value: 'draft',
                    enabled: _hasContent && _busy == _Busy.none,
                    child: const ListTile(leading: Icon(Icons.save), title: Text('Save draft')),
                  ),
                PopupMenuItem(
                  value: 'schedule',
                  enabled: _ready && _busy == _Busy.none,
                  child: ListTile(
                    leading: const Icon(Icons.schedule_send),
                    title: Text(_status == BlogStatus.scheduled ? 'Reschedule…' : 'Schedule…'),
                  ),
                ),
                if (!_autosaves)
                  const PopupMenuItem(
                    value: 'unpublish',
                    child: ListTile(leading: Icon(Icons.unpublished), title: Text('Move to drafts')),
                  ),
                PopupMenuItem(
                  value: 'discard',
                  enabled: _saved != null || _hasContent,
                  child: ListTile(
                    leading: const Icon(Icons.delete, color: Brand.danger),
                    title: Text(_saved != null ? 'Delete story' : 'Clear draft'),
                  ),
                ),
              ],
            ),
          ],
        ),
        body: _loadingStory
            ? const Padding(padding: EdgeInsets.all(20), child: Skeleton(height: 480))
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 48),
                children: _preview ? _previewBody(t) : _editorBody(t, pal),
              ),
      ),
    );
  }

  List<Widget> _editorBody(TextTheme t, Palette pal) => [
    // Cover
    if (_img.isNotEmpty)
      ClipRRect(
        borderRadius: BorderRadius.circular(Brand.radiusLg),
        child: AspectRatio(
          aspectRatio: 16 / 8,
          child: Stack(
            fit: StackFit.expand,
            children: [
              PoolImage(_img, large: true),
              Positioned(
                right: 8,
                bottom: 8,
                child: Row(
                  children: [
                    FilledButton.tonalIcon(
                      onPressed: _chooseCover,
                      icon: const Icon(Icons.image),
                      label: const Text('Change'),
                    ),
                    const SizedBox(width: 6),
                    IconButton.filledTonal(
                      tooltip: 'Remove cover',
                      onPressed: () => _setImg(''),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      )
    else
      OutlinedButton.icon(
        key: const Key('add-cover'),
        onPressed: _chooseCover,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 28),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Brand.radiusLg)),
        ),
        icon: const Icon(Icons.add_photo_alternate, color: Brand.brand),
        label: const Text('Add a cover from the Image Pool'),
      ),
    const SizedBox(height: 16),
    TextField(
      key: const Key('title'),
      controller: _title,
      maxLength: 200,
      maxLines: null,
      style: t.headlineMedium,
      decoration: const InputDecoration(
        hintText: 'Your headline…',
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        filled: false,
        counterText: '',
      ),
    ),
    Text(
      'By $_author${_saved != null && _saved!.date.isNotEmpty && _status != BlogStatus.draft ? ' · ${_saved!.date}' : ''}',
      key: const Key('byline'),
      style: TextStyle(color: pal.muted),
    ),
    const SizedBox(height: 12),
    TextField(
      key: const Key('blogp1'),
      controller: _blogp1,
      minLines: 2,
      maxLines: 6,
      maxLength: 2000,
      style: t.titleMedium?.copyWith(fontWeight: FontWeight.w500, height: 1.5),
      decoration: const InputDecoration(
        labelText: 'Opening',
        hintText: 'Hook your readers. This also appears on story cards.',
        counterText: '',
        alignLabelWithHint: true,
      ),
    ),
    const SizedBox(height: 16),
    RichEditor(
      key: const Key('editor'),
      initialHtml: _editorSeed,
      onChanged: (html) {
        _blogp2 = html;
        _changed();
      },
    ),
    if (_error.isNotEmpty) ErrorText(_error),
    const SizedBox(height: 20),
    _panel(t, 'Topics', [
      ChipWrap(
        children: [
          for (final topic in _topics)
            InputChip(
              label: Text(topic),
              onDeleted: () => _setCate(toggleTopic(_cate, topic)),
              deleteButtonTooltipMessage: 'Remove $topic',
            ),
        ],
      ),
      const SizedBox(height: 8),
      TextField(
        key: const Key('topic'),
        controller: _topic,
        maxLength: 40,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _addTopic(),
        decoration: InputDecoration(
          hintText: 'Add a topic',
          counterText: '',
          isDense: true,
          suffixIcon: IconButton(tooltip: 'Add topic', icon: const Icon(Icons.add), onPressed: _addTopic),
        ),
      ),
      if (_suggestions.any((s) => !_topics.contains(s))) ...[
        const SizedBox(height: 10),
        ChipWrap(
          children: [
            for (final s in _suggestions)
              if (!_topics.contains(s))
                ActionChip(label: Text('+ $s'), onPressed: () => _setCate(toggleTopic(_cate, s))),
          ],
        ),
      ],
    ]),
    _panel(t, 'Ready to publish?', [
      for (final (label, done) in _checks)
        ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          leading: Icon(
            done ? Icons.check_circle : Icons.radio_button_unchecked,
            color: done ? Brand.brand : pal.muted,
          ),
          title: Text(
            label,
            style: TextStyle(color: done ? null : pal.muted, fontWeight: FontWeight.w600),
          ),
        ),
    ]),
    _panel(t, 'Card preview', [PostCard(post: _previewPost, onTap: () {})]),
  ];

  Widget _panel(TextTheme t, String title, List<Widget> children) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [Eyebrow(title), const SizedBox(height: 10), ...children],
      ),
    ),
  );

  List<Widget> _previewBody(TextTheme t) {
    final post = _previewPost;
    return [
      ClipRRect(
        borderRadius: BorderRadius.circular(Brand.radiusLg),
        child: AspectRatio(aspectRatio: 16 / 9, child: PoolImage(post.img, large: true)),
      ),
      const SizedBox(height: 16),
      Text(post.title, key: const Key('preview-title'), style: t.headlineMedium),
      Text(
        'By $_author · ${readingTime(post.blogp1, post.blogp2)} min read',
        style: TextStyle(color: Palette.of(context).muted),
      ),
      const SizedBox(height: 16),
      Text(post.blogp1, style: t.titleMedium?.copyWith(height: 1.7)),
      const SizedBox(height: 12),
      HtmlWidget(post.blogp2, textStyle: t.bodyLarge),
    ];
  }
}
