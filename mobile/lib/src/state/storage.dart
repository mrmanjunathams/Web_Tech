import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';

/// Session cookie persisted across launches.
class PrefsCookieStore implements CookieStore {
  PrefsCookieStore(this._prefs);

  static const _key = 'bb-session';
  final SharedPreferences _prefs;

  @override
  String? read() => _prefs.getString(_key);

  @override
  Future<void> write(String? cookie) => cookie == null ? _prefs.remove(_key) : _prefs.setString(_key, cookie);
}

/// Light/dark theme, persisted on the device. Defaults to the OS preference (port of core/theme.ts).
class ThemeController extends ChangeNotifier {
  ThemeController(this._prefs);

  static const _key = 'bb-theme';
  final SharedPreferences _prefs;

  ThemeMode get mode => switch (_prefs.getString(_key)) {
    'dark' => ThemeMode.dark,
    'light' => ThemeMode.light,
    _ => ThemeMode.system,
  };

  bool isDark(BuildContext context) => switch (mode) {
    ThemeMode.dark => true,
    ThemeMode.light => false,
    ThemeMode.system => MediaQuery.platformBrightnessOf(context) == Brightness.dark,
  };

  Future<void> toggle(BuildContext context) async {
    await _prefs.setString(_key, isDark(context) ? 'light' : 'dark');
    notifyListeners();
  }
}

/// A new story not yet saved on the server, kept on the device so nothing is lost. [blogp2] is HTML.
class Draft {
  const Draft({this.title = '', this.cate = '', this.img = '', this.blogp1 = '', this.blogp2 = ''});

  final String title;
  final String cate;
  final String img;
  final String blogp1;
  final String blogp2;

  Map<String, Object?> toJson() => {'title': title, 'cate': cate, 'img': img, 'blogp1': blogp1, 'blogp2': blogp2};

  factory Draft.fromJson(Map<String, dynamic> j) => Draft(
    title: j['title'] as String? ?? '',
    cate: j['cate'] as String? ?? '',
    img: j['img'] as String? ?? '',
    blogp1: j['blogp1'] as String? ?? '',
    blogp2: j['blogp2'] as String? ?? '',
  );
}

class DraftStore {
  DraftStore(this._prefs);

  static const _key = 'bb-draft';
  final SharedPreferences _prefs;

  Draft? load() {
    try {
      final raw = _prefs.getString(_key);
      return raw == null ? null : Draft.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null; // ignore bad drafts
    }
  }

  Future<void> save(Draft d) => _prefs.setString(_key, jsonEncode(d.toJson()));

  Future<void> clear() => _prefs.remove(_key);
}
