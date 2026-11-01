// coverage:ignore-file
// Browser-only (selected by a conditional import on Flutter web); the VM test runner cannot load it.
import 'package:http/browser_client.dart';
import 'package:http/http.dart' as http;

/// Sends the session cookie with cross-origin API calls (the backend must list this origin in CORS_ORIGIN).
http.Client createHttpClient() => BrowserClient()..withCredentials = true;
