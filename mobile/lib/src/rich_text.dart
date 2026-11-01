// Story bodies are HTML (shared with the web app; the API sanitizes it). The mobile editor works on a
// Quill document, so these convert between the two.
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_quill_delta_from_html/flutter_quill_delta_from_html.dart';
import 'package:vsc_quill_delta_to_html/vsc_quill_delta_to_html.dart';

/// Quill document for an HTML body (an empty document for '').
Document documentFromHtml(String html) {
  if (html.trim().isEmpty) return Document();
  return Document.fromDelta(HtmlToDelta().convert(html));
}

/// HTML body for a Quill document ('' when it has no text).
String documentToHtml(Document doc) {
  if (doc.toPlainText().trim().isEmpty) return '';
  final ops = doc.toDelta().toJson().cast<Map<String, dynamic>>();
  return QuillDeltaToHtmlConverter(ops, ConverterOptions(multiLineParagraph: false)).convert();
}

/// Visible text of an HTML body, for word counts and search.
String textOf(String html) => html
    .replaceAll(RegExp(r'<(br|/p|/h[1-6]|/li|/blockquote|/pre|hr)\b[^>]*>', caseSensitive: false), '\n')
    .replaceAll(RegExp('<[^>]*>'), '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
