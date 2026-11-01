import 'package:intl/intl.dart';

import 'rich_text.dart';

/// Bundled Image Pool picture: 'sm' (800px) for cards and thumbnails, 'lg' (1800px) for covers and full screen.
String imageAsset(String img, {bool large = false}) => 'assets/picyourpic/opt/$img-${large ? 1800 : 800}.webp';

/// Categories are stored as "Travel | Vacation".
List<String> categoriesOf(String cate) => cate.split('|').map((c) => c.trim()).where((c) => c.isNotEmpty).toList();

int wordCount(Iterable<String> texts) => texts.join(' ').trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;

/// Words in a story: the plain-text opening plus the HTML body.
int storyWords(String blogp1, String blogp2) => wordCount([blogp1, textOf(blogp2)]);

/// Minutes to read at ~200 words per minute (at least 1).
int readingTime(String blogp1, String blogp2) {
  final m = (storyWords(blogp1, blogp2) / 200).round();
  return m < 1 ? 1 : m;
}

/// "Tue 3 Nov, 09:30" style label for a schedule time (local time).
String formatWhen(DateTime d) => DateFormat('EEE d MMM, HH:mm', 'en_US').format(d.toLocal());

String initials(String name) {
  final words = name.replaceAll(RegExp(r'[^A-Za-z0-9 ]'), ' ').trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  final letters = words.take(2).map((w) => w[0]).join();
  return (letters.isEmpty ? '?' : letters).toUpperCase();
}

/// Stable hue (0-359) derived from a name, used for avatar gradients. Same result as the web app.
int hueOf(String name) {
  var h = 0;
  for (final ch in name.codeUnits) {
    h = (h * 31 + ch) % 360;
  }
  return h;
}

final _compact = NumberFormat.compact(locale: 'en');

String compact(num n) => _compact.format(n);

/// Blog dates are stored as display strings like "01-NOV-2026".
String displayDate(DateTime d) => DateFormat('dd-MMM-yyyy', 'en_US').format(d).toUpperCase();

/// Password strength, 0 (too short) to 4 (excellent).
int passwordStrength(String p) {
  if (p.length < 6) return 0;
  var score = 1;
  if (p.length >= 10) score++;
  if (RegExp('[A-Z]').hasMatch(p) && RegExp('[a-z]').hasMatch(p)) score++;
  if (RegExp(r'\d').hasMatch(p) && RegExp('[^A-Za-z0-9]').hasMatch(p)) score++;
  return score > 4 ? 4 : score;
}

const strengthLevels = ['Too short', 'Weak', 'Okay', 'Strong', 'Excellent'];

final usernameRe = RegExp(r'^[A-Za-z0-9_.-]{3,30}$');
final emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
