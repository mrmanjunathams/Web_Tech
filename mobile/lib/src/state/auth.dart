import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/models.dart';

/// Signed-in user (port of core/auth.ts). [user] is null when signed out.
class AuthController extends ChangeNotifier {
  AuthController(this._api);

  final ApiClient _api;

  Account? _user;
  Account? get user => _user;

  bool _loaded = false;

  Future<Account?>? _pending;

  /// Fetches the signed-in user's account; resolves to null when signed out.
  Future<Account?> load() => _pending ??= _load().whenComplete(() => _pending = null);

  Future<Account?> _load() async {
    try {
      final json = await _api.get('/myacc') as Map<String, dynamic>;
      _set(Account.fromJson(json));
    } catch (_) {
      _set(null);
    }
    return _user;
  }

  /// Like [load], but only hits the API the first time.
  Future<Account?> ensureLoaded() async => _loaded ? _user : load();

  Future<void> signup({
    required String username,
    required String name,
    required String email,
    required String password,
  }) async {
    await _api.post('/adduser', {'username': username, 'name': name, 'email': email, 'password': password});
    await load();
  }

  /// Changes the display name; the updated account replaces [user].
  Future<void> rename(String name) async {
    _set(Account.fromJson(await _api.patch('/myacc', {'name': name}) as Map<String, dynamic>));
  }

  Future<void> login({required String username, required String password}) async {
    await _api.post('/loginuser', {'username': username, 'password': password});
    await load();
  }

  Future<void> logout() async {
    try {
      await _api.post('/logout');
    } catch (_) {
      // Signed out locally either way.
    } finally {
      _set(null);
    }
  }

  void _set(Account? user) {
    _user = user;
    _loaded = true;
    notifyListeners();
  }
}
