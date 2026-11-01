import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/api_client.dart';
import '../../router.dart';
import '../../state/app_scope.dart';
import '../shell.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/feedback.dart';

/// Decorative header for the sign-in / sign-up screens (port of shared/auth-art.ts).
class AuthArt extends StatelessWidget {
  const AuthArt({
    super.key,
    this.quote = 'There is no greater agony than bearing an untold story inside you.',
    this.by = 'Maya Angelou',
  });

  final String quote;
  final String by;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 170,
    child: Stack(
      children: [
        for (final (i, img) in const ['img5', 'img11', 'img9'].indexed)
          Positioned(
            left: 20.0 + i * 70,
            top: 8.0 + (i.isOdd ? 18 : 0),
            child: Transform.rotate(
              angle: (i - 1) * .1,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(Brand.radiusSm),
                child: SizedBox(width: 110, height: 120, child: ExcludeSemantics(child: PoolImage(img))),
              ),
            ),
          ),
        Positioned(
          right: 20,
          bottom: 0,
          left: 120,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Palette.of(context).surfaceSolid.withValues(alpha: .92),
              borderRadius: BorderRadius.circular(Brand.radiusSm),
              border: Border.all(color: Palette.of(context).border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  quote,
                  style: const TextStyle(fontStyle: FontStyle.italic, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text('— $by', style: TextStyle(color: Palette.of(context).muted, fontSize: 12)),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;
  bool _loading = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    for (final c in [_username, _password]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _valid => _username.text.trim().isNotEmpty && _password.text.isNotEmpty;

  Future<void> _submit() async {
    if (_loading || !_valid) return;
    setState(() {
      _loading = true;
      _error = '';
    });
    final username = _username.text.trim();
    try {
      final auth = AppScope.of(context).auth;
      await auth.login(username: username, password: _password.text);
      showToast('Welcome back, ${auth.user?.displayName ?? username}!', ToastKind.success);
      if (mounted) resetTo(context, '/myacc');
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Sign in failed. Please try again.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => PageScaffold(
    body: AutofillGroup(
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          const SizedBox(height: 12),
          const AuthArt(),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Glass(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Eyebrow('Welcome back'),
                  const SizedBox(height: 8),
                  SplitHeadline('Sign in to ', 'keep writing', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 20),
                  TextField(
                    key: const Key('username'),
                    controller: _username,
                    autofillHints: const [AutofillHints.username],
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      hintText: 'your_username',
                      prefixIcon: Icon(Icons.alternate_email),
                    ),
                  ),
                  const SizedBox(height: 14),
                  PasswordField(
                    key: const Key('password'),
                    controller: _password,
                    show: _show,
                    onToggle: () => setState(() => _show = !_show),
                    onSubmitted: _submit,
                    autofill: AutofillHints.password,
                    hint: '••••••••',
                  ),
                  if (_error.isNotEmpty) ErrorText(_error),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    key: const Key('submit'),
                    onPressed: _valid && !_loading ? _submit : null,
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.arrow_forward),
                    label: Text(_loading ? 'Signing in…' : 'Sign in'),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text('New to Bloggerbytes?', style: TextStyle(color: Palette.of(context).muted)),
                      TextButton(
                        onPressed: () => context.pushReplacement('/signup'),
                        child: const Text('Create a free account'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class PasswordField extends StatelessWidget {
  const PasswordField({
    super.key,
    required this.controller,
    required this.show,
    required this.onToggle,
    required this.onSubmitted,
    required this.autofill,
    required this.hint,
  });

  final TextEditingController controller;
  final bool show;
  final VoidCallback onToggle;
  final VoidCallback onSubmitted;
  final String autofill;
  final String hint;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    obscureText: !show,
    autofillHints: [autofill],
    textInputAction: TextInputAction.done,
    onSubmitted: (_) => onSubmitted(),
    decoration: InputDecoration(
      labelText: 'Password',
      hintText: hint,
      prefixIcon: const Icon(Icons.lock),
      suffixIcon: IconButton(
        tooltip: show ? 'Hide password' : 'Show password',
        icon: Icon(show ? Icons.visibility_off : Icons.visibility),
        onPressed: onToggle,
      ),
    ),
  );
}
