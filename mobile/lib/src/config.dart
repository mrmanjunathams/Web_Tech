import 'package:flutter/foundation.dart';

/// Build-time configuration, set with `--dart-define=KEY=value`.
abstract final class AppConfig {
  /// Base URL of the Bloggerbytes API (the Express backend), without a trailing slash.
  ///
  /// Defaults: the Android emulator reaches the host machine at 10.0.2.2; everything else uses localhost.
  /// On Flutter web, set CORS_ORIGIN on the backend to the app's origin.
  static String get apiBaseUrl =>
      apiBaseUrlFor(const String.fromEnvironment('API_BASE_URL'), defaultTargetPlatform, isWeb: kIsWeb);

  /// Public site used for share links (`<site>/#/post/<id>`). Defaults to the API host, which serves the web app.
  static String get siteUrl => siteUrlFor(const String.fromEnvironment('SITE_URL'), apiBaseUrl);

  @visibleForTesting
  static String apiBaseUrlFor(String fromEnv, TargetPlatform platform, {required bool isWeb}) {
    if (fromEnv.isNotEmpty) return _trim(fromEnv);
    if (!isWeb && platform == TargetPlatform.android) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  @visibleForTesting
  static String siteUrlFor(String fromEnv, String apiBaseUrl) => fromEnv.isNotEmpty ? _trim(fromEnv) : apiBaseUrl;

  static String _trim(String url) => url.endsWith('/') ? url.substring(0, url.length - 1) : url;
}
