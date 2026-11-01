import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../api/api_client.dart';
import '../../router.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../shell.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/feedback.dart';
import 'login.dart';

const _strengthColors = [Brand.danger, Brand.danger, Brand.amber, Brand.brand, Brand.violet];

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;
  bool _loading = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    for (final c in [_name, _username, _email, _password]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  /// 1-60 visible characters, like the API.
  bool get _nameOk => _name.text.trim().isNotEmpty && _name.text.trim().length <= 60;
  bool get _usernameOk => usernameRe.hasMatch(_username.text);
  bool get _emailOk => emailRe.hasMatch(_email.text.trim());
  bool get _passwordOk => _password.text.length >= 6 && _password.text.length <= 128;
  bool get _valid => _nameOk && _usernameOk && _emailOk && _passwordOk;

  Future<void> _submit() async {
    if (_loading || !_valid) return;
    setState(() {
      _loading = true;
      _error = '';
    });
    final name = _name.text.trim();
    try {
      await AppScope.of(context).auth
          .signup(username: _username.text, name: name, email: _email.text.trim(), password: _password.text);
      showToast('Welcome to Bloggerbytes, $name!', ToastKind.success);
      if (mounted) resetTo(context, '/myacc');
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Sign up failed. Please try again.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strength = passwordStrength(_password.text);
    return PageScaffold(
      body: AutofillGroup(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 32),
          children: [
            const SizedBox(height: 12),
            const AuthArt(quote: 'You can make anything by writing.', by: 'C.S. Lewis'),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Glass(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Eyebrow('Join free'),
                    const SizedBox(height: 8),
                    SplitHeadline('Your stories ', 'deserve a stage', style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 20),
                    TextField(
                      key: const Key('name'),
                      controller: _name,
                      maxLength: 60,
                      autofillHints: const [AutofillHints.name],
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'Your name',
                        hintText: 'Shown on your stories',
                        prefixIcon: const Icon(Icons.badge),
                        counterText: '',
                        errorText: _name.text.isNotEmpty && !_nameOk
                            ? 'Please enter your name (up to 60 characters).'
                            : null,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      key: const Key('username'),
                      controller: _username,
                      maxLength: 30,
                      autofillHints: const [AutofillHints.newUsername],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'Username',
                        helperText: 'For signing in',
                        hintText: 'your_username',
                        prefixIcon: const Icon(Icons.alternate_email),
                        counterText: '',
                        errorText: _username.text.isNotEmpty && !_usernameOk
                            ? '3–30 characters: letters, numbers, . _ -'
                            : null,
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      key: const Key('email'),
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'Email',
                        hintText: 'you@example.com',
                        prefixIcon: const Icon(Icons.mail),
                        errorText: _email.text.isNotEmpty && !_emailOk ? 'Please enter a valid email.' : null,
                      ),
                    ),
                    const SizedBox(height: 14),
                    PasswordField(
                      key: const Key('password'),
                      controller: _password,
                      show: _show,
                      onToggle: () => setState(() => _show = !_show),
                      onSubmitted: _submit,
                      autofill: AutofillHints.newPassword,
                      hint: 'At least 6 characters',
                    ),
                    if (_password.text.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          for (var i = 0; i < 4; i++)
                            Expanded(
                              child: Container(
                                height: 5,
                                margin: const EdgeInsets.only(right: 4),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: i < strength ? _strengthColors[strength] : Palette.of(context).border,
                                ),
                              ),
                            ),
                          const SizedBox(width: 8),
                          Text(
                            strengthLevels[strength],
                            key: const Key('strength'),
                            style: TextStyle(
                              color: _strengthColors[strength],
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (_error.isNotEmpty) ErrorText(_error),
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      key: const Key('submit'),
                      onPressed: _valid && !_loading ? _submit : null,
                      iconAlignment: IconAlignment.end,
                      icon: const Icon(Icons.arrow_forward),
                      label: Text(_loading ? 'Creating your account…' : 'Create account'),
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text('Already have an account?', style: TextStyle(color: Palette.of(context).muted)),
                        TextButton(onPressed: () => context.pushReplacement('/login'), child: const Text('Sign in')),
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
}
