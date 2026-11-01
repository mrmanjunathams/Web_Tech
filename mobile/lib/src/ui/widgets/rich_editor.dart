import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';

import '../../rich_text.dart';
import '../theme.dart';

/// Rich-text editor for story bodies: headings, bold/italic/underline/strike, inline code and code blocks,
/// lists, quotes and links, with undo/redo. Reports the body as HTML (the same format the web editor uses).
class RichEditor extends StatefulWidget {
  const RichEditor({
    super.key,
    required this.initialHtml,
    required this.onChanged,
    this.placeholder = 'Tell your story…',
  });

  /// Content when the editor opens. A different value later (e.g. a cleared draft) replaces the content.
  final String initialHtml;
  final ValueChanged<String> onChanged;
  final String placeholder;

  @override
  State<RichEditor> createState() => RichEditorState();
}

class RichEditorState extends State<RichEditor> {
  late QuillController controller = _controllerFor(widget.initialHtml);
  final _focus = FocusNode();
  final _scroll = ScrollController();
  StreamSubscription<DocChange>? _changes;
  String _html = '';

  @override
  void initState() {
    super.initState();
    _html = widget.initialHtml;
    _listen();
  }

  @override
  void didUpdateWidget(RichEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Replaced from outside (not an echo of our own edit).
    if (widget.initialHtml != oldWidget.initialHtml && widget.initialHtml != _html) {
      _changes?.cancel();
      controller.dispose();
      controller = _controllerFor(widget.initialHtml);
      _html = widget.initialHtml;
      _listen();
    }
  }

  QuillController _controllerFor(String html) =>
      QuillController(document: documentFromHtml(html), selection: const TextSelection.collapsed(offset: 0));

  void _listen() {
    _changes = controller.document.changes.listen((_) {
      setState(() => _html = documentToHtml(controller.document));
      widget.onChanged(_html);
    });
  }

  @override
  void dispose() {
    _changes?.cancel();
    controller.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final words = textOf(_html).trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
    return Container(
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(Brand.radius),
        border: Border.all(color: p.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: p.border)),
            ),
            padding: const EdgeInsets.all(4),
            child: QuillSimpleToolbar(
              controller: controller,
              config: const QuillSimpleToolbarConfig(
                multiRowsDisplay: true,
                showFontFamily: false,
                showFontSize: false,
                showColorButton: false,
                showBackgroundColorButton: false,
                showListCheck: false,
                showIndent: false,
                showSearchButton: false,
                showSubscript: false,
                showSuperscript: false,
                headerStyleType: HeaderStyleType.buttons,
              ),
            ),
          ),
          QuillEditor(
            controller: controller,
            focusNode: _focus,
            scrollController: _scroll,
            config: QuillEditorConfig(
              placeholder: widget.placeholder,
              padding: const EdgeInsets.all(16),
              minHeight: 260,
              scrollable: false,
              expands: false,
            ),
          ),
          Container(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: p.border)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              '$words ${words == 1 ? 'word' : 'words'}',
              key: const Key('editor-words'),
              style: TextStyle(color: p.muted, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
