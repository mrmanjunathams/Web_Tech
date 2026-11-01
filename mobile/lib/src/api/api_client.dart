import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'http_client_stub.dart' if (dart.library.js_interop) 'http_client_web.dart' as platform;

/// Error from the API (or the network), with a message suitable for showing to the user.
class ApiException implements Exception {
  const ApiException(this.status, this.message);

  /// HTTP status, or 0 when the server could not be reached.
  final int status;
  final String? message;

  @override
  String toString() => 'ApiException($status, $message)';
}

/// Turns an error into a user-facing message (port of errorMessage() in core/api.ts).
String errorMessage(Object err, String fallback) {
  if (err is ApiException) {
    if (err.message != null && err.message!.isNotEmpty) return err.message!;
    if (err.status == 0) return 'Cannot reach the server. Is it running?';
  }
  return fallback;
}

/// Where the session cookie is kept between app launches.
abstract class CookieStore {
  String? read();
  Future<void> write(String? cookie);
}

class MemoryCookieStore implements CookieStore {
  MemoryCookieStore([this._value]);
  String? _value;

  @override
  String? read() => _value;

  @override
  Future<void> write(String? cookie) async => _value = cookie;
}

/// JSON client for the Bloggerbytes API.
///
/// Auth is the `bb.sid` cookie session. Browsers manage it themselves (requests are sent with credentials);
/// on mobile the cookie is captured from `Set-Cookie`, persisted in [CookieStore] and replayed on each request.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client, CookieStore? cookies, bool? manageCookies})
    : _http = client ?? platform.createHttpClient(),
      _cookies = cookies ?? MemoryCookieStore(),
      _manageCookies = manageCookies ?? !kIsWeb;

  static const cookieName = 'bb.sid';
  static final _cookieRe = RegExp('(?:^|[\\s,;])${RegExp.escape(cookieName)}=([^;,]*)');
  static const _timeout = Duration(seconds: 20);

  final String baseUrl;
  final http.Client _http;
  final CookieStore _cookies;
  final bool _manageCookies;

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body = const {}]) => _send('POST', path, body);
  Future<dynamic> patch(String path, Object? body) => _send('PATCH', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'))..headers['Accept'] = 'application/json';
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    final cookie = _cookies.read();
    if (_manageCookies && cookie != null) req.headers['Cookie'] = '$cookieName=$cookie';

    final http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(_timeout)).timeout(_timeout);
    } catch (_) {
      // Timeout, SocketException, ClientException, XMLHttpRequest errors...
      // Naming the address makes a wrong API_BASE_URL obvious (e.g. 10.0.2.2 on a real phone).
      throw ApiException(0, 'Cannot reach the server at $baseUrl. Is it running?');
    }

    if (_manageCookies) await _captureCookie(res.headers['set-cookie']);

    final data = _decode(res);
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final message = data is Map && data['error'] is String ? data['error'] as String : null;
    throw ApiException(res.statusCode, message);
  }

  Future<void> _captureCookie(String? header) async {
    if (header == null) return;
    final m = _cookieRe.firstMatch(header);
    if (m == null) return;
    // res.clearCookie() on logout sends an empty value.
    final value = m.group(1)!;
    await _cookies.write(value.isEmpty ? null : value);
  }

  static dynamic _decode(http.Response res) {
    if (res.body.isEmpty) return null;
    try {
      return jsonDecode(utf8.decode(res.bodyBytes));
    } on FormatException {
      return null;
    }
  }
}
