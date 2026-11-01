import 'package:flutter/material.dart';

import '../theme.dart';

/// Lets toasts outlive the screen that showed them (e.g. "Signed out" after navigating home).
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

enum ToastKind { success, error, info }

/// Small notification (port of core/toast.ts).
void showToast(String text, [ToastKind kind = ToastKind.info]) {
  final (icon, color) = switch (kind) {
    ToastKind.success => (Icons.check_circle, Brand.brand),
    ToastKind.error => (Icons.error, Brand.danger),
    ToastKind.info => (Icons.info, Brand.violet),
  };
  scaffoldMessengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        duration: Duration(milliseconds: kind == ToastKind.error ? 5000 : 3500),
        content: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 10),
            Expanded(child: Text(text)),
          ],
        ),
      ),
    );
}

/// In-app confirmation dialog (port of core/confirm.ts). Resolves to true when confirmed.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  String text = '',
  String okLabel = 'Confirm',
  bool danger = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: text.isEmpty ? null : Text(text),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: Brand.danger, foregroundColor: Colors.white) : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(okLabel),
        ),
      ],
    ),
  );
  return ok ?? false;
}
