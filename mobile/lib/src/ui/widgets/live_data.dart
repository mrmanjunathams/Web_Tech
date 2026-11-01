import 'package:flutter/widgets.dart';

import '../../state/app_scope.dart';

/// For screens that show server data: calls [reload] once on open, and again (quietly) whenever a story
/// is published, deleted or liked, or the user signs in or out — so screens left open underneath stay current.
mixin LiveData<T extends StatefulWidget> on State<T> {
  Listenable? _source;

  /// [initial] is true for the first load (show skeletons), false for background refreshes.
  Future<void> reload({required bool initial});

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_source != null) return;
    final services = AppScope.of(context);
    _source = Listenable.merge([services.posts.changes, services.auth])..addListener(_onChange);
    reload(initial: true);
  }

  void _onChange() {
    if (mounted) reload(initial: false);
  }

  @override
  void dispose() {
    _source?.removeListener(_onChange);
    super.dispose();
  }
}
