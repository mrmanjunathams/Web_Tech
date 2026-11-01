// Fails unless every line in lib/ is covered by `flutter test --coverage`.
//
//   flutter test --coverage --exclude-tags backend && dart run tool/check_coverage.dart
//
// Honours the standard markers: `// coverage:ignore-file`, `// coverage:ignore-line`,
// `// coverage:ignore-start` ... `// coverage:ignore-end`. Use them only for code that cannot run in tests
// (e.g. the browser-only HTTP client).
import 'dart:io';

void main(List<String> args) {
  final lcov = File(args.isNotEmpty ? args.first : 'coverage/lcov.info');
  if (!lcov.existsSync()) {
    stderr.writeln('No ${lcov.path}; run "flutter test --coverage" first.');
    exit(2);
  }

  final hits = <String, Map<int, int>>{};
  String? file;
  for (final line in lcov.readAsLinesSync()) {
    if (line.startsWith('SF:')) {
      file = line.substring(3).replaceAll(r'\', '/');
      hits.putIfAbsent(file, () => {});
    } else if (line.startsWith('DA:') && file != null) {
      final [n, count] = line.substring(3).split(',').take(2).toList();
      hits[file]![int.parse(n)] = int.parse(count);
    }
  }

  // Every Dart file in lib/ must appear, even if no test loaded it.
  final sources = Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'));
  var total = 0;
  var covered = 0;
  final missed = <String>[];
  for (final src in sources) {
    final path = src.path.replaceAll(r'\', '/');
    final text = src.readAsLinesSync();
    if (text.any((l) => l.contains('coverage:ignore-file'))) continue;
    final ignored = <int>{};
    var skipping = false;
    for (var i = 0; i < text.length; i++) {
      final l = text[i];
      if (l.contains('coverage:ignore-start')) skipping = true;
      if (skipping || l.contains('coverage:ignore-line')) ignored.add(i + 1);
      if (l.contains('coverage:ignore-end')) skipping = false;
    }
    final entry = hits.entries.where((e) => e.key.endsWith(path)).firstOrNull;
    if (entry == null) {
      missed.add('$path: not loaded by any test');
      total++;
      continue;
    }
    final lines = entry.value.entries.where((e) => !ignored.contains(e.key));
    final uncovered = [
      for (final e in lines)
        if (e.value == 0) e.key,
    ];
    total += lines.length;
    covered += lines.length - uncovered.length;
    if (uncovered.isNotEmpty) missed.add('$path: lines ${uncovered.join(', ')}');
  }

  final pct = total == 0 ? 100 : covered * 100 / total;
  stdout.writeln('Line coverage: ${pct.toStringAsFixed(2)}% ($covered/$total)');
  if (missed.isNotEmpty) {
    stdout.writeln('Not covered:\n  ${missed.join('\n  ')}');
    exit(1);
  }
}
