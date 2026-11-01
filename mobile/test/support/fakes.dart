import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:share_plus_platform_interface/share_plus_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

/// Records launched URLs; [result] is what the platform answers.
class FakeLauncher extends UrlLauncherPlatform with MockPlatformInterfaceMixin {
  final launched = <String>[];
  bool result = true;

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launched.add(url);
    return result;
  }
}

/// Records shares; throws when [fail] is set (e.g. no share sheet on the platform).
class FakeShare extends SharePlatform with MockPlatformInterfaceMixin {
  final shared = <ShareParams>[];
  bool fail = false;

  @override
  Future<ShareResult> share(ShareParams params) async {
    if (fail) throw PlatformException(code: 'unavailable');
    shared.add(params);
    return const ShareResult('ok', ShareResultStatus.success);
  }
}

/// An asset bundle with nothing in it.
class EmptyBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) => Future.error(FlutterError('No asset $key'));
}
