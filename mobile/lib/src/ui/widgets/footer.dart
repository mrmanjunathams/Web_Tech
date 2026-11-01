import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api/api_client.dart';
import '../../state/app_scope.dart';
import '../../utils.dart';
import '../theme.dart';
import 'common.dart';

const contactEmail = 'bloggerbytesinfo@gmail.com';
final contactUri = Uri.parse('mailto:$contactEmail?subject=Hello%20Bloggerbytes');

const footerTopics = ['Travel', 'Art', 'Ocean', 'Office', 'Women'];

const _socials = [
  ('Facebook', Icons.facebook, 'https://www.facebook.com/Bloggerbytes-319605895260048/'),
  ('X (Twitter)', Icons.alternate_email, 'https://twitter.com/bloggerbytes'),
  ('Telegram', Icons.send, 'https://t.me/bloggerbytes'),
];

Future<void> openExternal(Uri uri) async {
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    // Nothing installed to handle it (e.g. no mail app); fail quietly like a dead link.
  }
}

/// Email sign-up for the weekly newsletter (port of shared/newsletter.ts).
class Newsletter extends StatefulWidget {
  const Newsletter({super.key});

  @override
  State<Newsletter> createState() => _NewsletterState();
}

class _NewsletterState extends State<Newsletter> {
  final _email = TextEditingController();
  bool _loading = false;
  String _message = '';
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _email.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  bool get _valid => emailRe.hasMatch(_email.text.trim());

  Future<void> _subscribe() async {
    if (!_valid || _loading) return;
    setState(() {
      _loading = true;
      _message = '';
    });
    try {
      await AppScope.of(context).posts.subscribe(_email.text.trim());
      _failed = false;
      _message = "You're in. Fresh stories, straight to your inbox.";
      _email.clear();
    } catch (err) {
      _failed = true;
      _message = errorMessage(err, 'Could not subscribe. Please try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Row(
        children: [
          Expanded(
            child: TextField(
              key: const Key('newsletter-email'),
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _subscribe(),
              decoration: const InputDecoration(hintText: 'you@example.com', labelText: 'Email', isDense: true),
            ),
          ),
          const SizedBox(width: 10),
          FilledButton(
            onPressed: _valid && !_loading ? _subscribe : null,
            child: Text(_loading ? 'Joining…' : 'Subscribe'),
          ),
        ],
      ),
      if (_message.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text(
            _message,
            style: TextStyle(color: _failed ? Brand.danger : Brand.brand, fontWeight: FontWeight.w600),
          ),
        ),
    ],
  );
}

/// Newsletter, quick links and socials, shown at the end of the main pages (the web footer).
class SiteFooter extends StatelessWidget {
  const SiteFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final p = Palette.of(context);
    final t = Theme.of(context).textTheme;
    Widget link(String label, VoidCallback onTap) => InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Text(
          label,
          style: TextStyle(color: p.muted, fontWeight: FontWeight.w600),
        ),
      ),
    );
    Widget col(String title, List<Widget> links) => Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          ...links,
        ],
      ),
    );

    return Container(
      margin: const EdgeInsets.only(top: 48),
      padding: const EdgeInsets.fromLTRB(20, 32, 20, 28),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Eyebrow('Newsletter'),
          const SizedBox(height: 8),
          SplitHeadline('Stories worth your ', 'inbox', trailing: '.', style: t.headlineSmall),
          const SizedBox(height: 6),
          Text(
            'One email a week. The best new writing on Bloggerbytes, nothing else.',
            style: TextStyle(color: p.muted),
          ),
          const SizedBox(height: 14),
          const Newsletter(),
          const SizedBox(height: 28),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              col('Read', [
                link('Featured stories', () => context.go('/blog')),
                link('Explore', () => context.go('/cate')),
                link('Leaderboard', () => context.go('/rewards')),
              ]),
              col('Create', [
                link('Write a story', () => context.push('/writeblog')),
                link('Image Pool', () => context.go('/gallery')),
                link('Dashboard', () => context.push('/myacc')),
              ]),
              col('Topics', [
                for (final topic in footerTopics)
                  link(topic, () => context.go(Uri(path: '/cate', queryParameters: {'q': topic}).toString())),
              ]),
            ],
          ),
          const SizedBox(height: 24),
          Center(
            child: GradientText(
              'bloggerbytes',
              style: t.displaySmall?.copyWith(fontWeight: FontWeight.w900, letterSpacing: -2),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: '© ${DateTime.now().year} Bloggerbytes · Proudly built by '),
                      const TextSpan(
                        text: 'Manjunatha M S',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  style: t.bodySmall?.copyWith(color: p.muted),
                ),
              ),
              for (final (label, icon, url) in _socials)
                IconButton(tooltip: label, icon: Icon(icon, size: 20), onPressed: () => openExternal(Uri.parse(url))),
              IconButton(
                tooltip: 'Email',
                icon: const Icon(Icons.mail, size: 20),
                onPressed: () => openExternal(contactUri),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
