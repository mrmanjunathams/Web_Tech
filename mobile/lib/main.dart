import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_quill/flutter_quill.dart' show FlutterQuillLocalizations;
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'src/api/api_client.dart';
import 'src/api/posts_api.dart';
import 'src/config.dart';
import 'src/router.dart';
import 'src/state/app_scope.dart';
import 'src/state/auth.dart';
import 'src/state/storage.dart';
import 'src/ui/theme.dart';
import 'src/ui/widgets/feedback.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final api = ApiClient(baseUrl: AppConfig.apiBaseUrl, cookies: PrefsCookieStore(prefs));
  final auth = AuthController(api);
  final services = AppServices(
    posts: PostsApi(api),
    auth: auth,
    theme: ThemeController(prefs),
    drafts: DraftStore(prefs),
  );
  auth.load();
  runApp(BloggerbytesApp(services: services, router: buildRouter(auth)));
}

class BloggerbytesApp extends StatelessWidget {
  const BloggerbytesApp({super.key, required this.services, required this.router});

  final AppServices services;
  final GoRouter router;

  @override
  Widget build(BuildContext context) => AppScope(
    services: services,
    child: ListenableBuilder(
      listenable: services.theme,
      builder: (context, _) => MaterialApp.router(
        title: 'Bloggerbytes',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        themeMode: services.theme.mode,
        scaffoldMessengerKey: scaffoldMessengerKey,
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
          FlutterQuillLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        routerConfig: router,
      ),
    ),
  );
}
