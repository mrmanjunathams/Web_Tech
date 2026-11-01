import 'package:flutter/material.dart';

/// Design tokens from frontend/src/styles.css.
abstract final class Brand {
  static const brand = Color(0xFF17BEBB);
  static const violet = Color(0xFF7C5CFF);
  static const pink = Color(0xFFFF4D8D);
  static const amber = Color(0xFFFFB547);
  static const danger = Color(0xFFFF5C7A);

  static const gradient = LinearGradient(
    begin: Alignment(-1, -0.4),
    end: Alignment(1, 0.4),
    colors: [brand, violet, pink],
    stops: [0, .52, 1],
  );

  static const radiusSm = 12.0;
  static const radius = 20.0;
  static const radiusLg = 28.0;
}

/// Theme-dependent colors (the CSS custom properties that change between light and dark).
@immutable
class Palette extends ThemeExtension<Palette> {
  const Palette({
    required this.bg,
    required this.text,
    required this.muted,
    required this.surface,
    required this.surfaceSolid,
    required this.border,
  });

  final Color bg;
  final Color text;
  final Color muted;
  final Color surface;
  final Color surfaceSolid;
  final Color border;

  static const dark = Palette(
    bg: Color(0xFF07070D),
    text: Color(0xFFEEECF8),
    muted: Color(0xFFA3A1B8),
    surface: Color(0x0BFFFFFF),
    surfaceSolid: Color(0xFF12121E),
    border: Color(0x1AFFFFFF),
  );

  static const light = Palette(
    bg: Color(0xFFF7F6FC),
    text: Color(0xFF15131F),
    muted: Color(0xFF5F5C74),
    surface: Color(0xB8FFFFFF),
    surfaceSolid: Color(0xFFFFFFFF),
    border: Color(0x1715131F),
  );

  static Palette of(BuildContext context) => Theme.of(context).extension<Palette>()!;

  @override
  Palette copyWith() => this;

  @override
  Palette lerp(Palette? other, double t) {
    if (other == null) return this;
    return Palette(
      bg: Color.lerp(bg, other.bg, t)!,
      text: Color.lerp(text, other.text, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceSolid: Color.lerp(surfaceSolid, other.surfaceSolid, t)!,
      border: Color.lerp(border, other.border, t)!,
    );
  }
}

ThemeData buildTheme(Brightness brightness) {
  final p = brightness == Brightness.dark ? Palette.dark : Palette.light;
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.violet,
    brightness: brightness,
    primary: Brand.brand,
    secondary: Brand.violet,
    tertiary: Brand.pink,
    error: Brand.danger,
    surface: p.surfaceSolid,
    onSurface: p.text,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  final text = base.textTheme.apply(bodyColor: p.text, displayColor: p.text);
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(999));

  return base.copyWith(
    scaffoldBackgroundColor: p.bg,
    extensions: [p],
    textTheme: text.copyWith(
      displaySmall: text.displaySmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -1, height: 1.08),
      headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -.6, height: 1.12),
      headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -.4),
      titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w800),
      titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      bodyLarge: text.bodyLarge?.copyWith(height: 1.6),
      bodyMedium: text.bodyMedium?.copyWith(height: 1.5),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: p.bg.withValues(alpha: .86),
      surfaceTintColor: Colors.transparent,
      foregroundColor: p.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surfaceSolid,
      indicatorColor: Brand.brand.withValues(alpha: .18),
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStatePropertyAll(text.labelSmall?.copyWith(fontWeight: FontWeight.w700)),
    ),
    drawerTheme: DrawerThemeData(backgroundColor: p.surfaceSolid),
    dividerTheme: DividerThemeData(color: p.border),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Brand.radius),
        side: BorderSide(color: p.border),
      ),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: p.surface,
      selectedColor: Brand.brand.withValues(alpha: .22),
      side: BorderSide(color: p.border),
      shape: shape,
      labelStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Brand.radiusSm),
        borderSide: BorderSide(color: p.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Brand.radiusSm),
        borderSide: BorderSide(color: p.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Brand.radiusSm),
        borderSide: const BorderSide(color: Brand.brand, width: 1.6),
      ),
      hintStyle: TextStyle(color: p.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.brand,
        foregroundColor: const Color(0xFF041615),
        shape: shape,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: p.text,
        side: BorderSide(color: p.border),
        shape: shape,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: p.surfaceSolid,
      contentTextStyle: TextStyle(color: p.text, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Brand.radiusSm),
        side: BorderSide(color: p.border),
      ),
    ),
    dialogTheme: DialogThemeData(backgroundColor: p.surfaceSolid, surfaceTintColor: Colors.transparent),
  );
}
