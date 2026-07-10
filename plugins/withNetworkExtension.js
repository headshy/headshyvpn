const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_NAME = 'HeadshyVPNTunnel';
const APP_NAME = 'HeadshyVPN'; // Имя твоего Xcode проекта

const withNetworkExtension = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, 'ios');
      const extensionSourceDir = path.join(projectRoot, 'ios-extension');
      
      const iosDestinationDir = path.join(iosPath, EXTENSION_NAME);
      const appTargetDir = path.join(iosPath, APP_NAME);

      // 1. Копируем файлы туннеля
      if (!fs.existsSync(iosDestinationDir)) fs.mkdirSync(iosDestinationDir, { recursive: true });
      const copyRecursiveSync = (src, dest) => {
        if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest);
          fs.readdirSync(src).forEach((child) => copyRecursiveSync(path.join(src, child), path.join(dest, child)));
        } else {
          fs.copyFileSync(src, dest);
        }
      };
      if (fs.existsSync(extensionSourceDir)) copyRecursiveSync(extensionSourceDir, iosDestinationDir);

      // 2. Генерируем Info.plist
      const bundleId = config.ios.bundleIdentifier + '.tunnel';
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>HeadshyVPNTunnel</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>${bundleId}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.networkextension.packet-tunnel</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).PacketTunnelProvider</string>
    </dict>
</dict>
</plist>`;
      fs.writeFileSync(path.join(iosDestinationDir, 'Info.plist'), plistContent);

      // 3. НОВЫЙ ШАГ: Пишем файлы моста прямо в папку приложения
      const swiftBridgeCode = `import Foundation
import NetworkExtension

@objc(VpnManager)
class VpnManager: NSObject {
  private var tunnelBundleId: String { return Bundle.main.bundleIdentifier! + ".tunnel" }

  @objc func startVPN(_ config: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      if let error = error { reject("ERR", "Load error", error); return }
      
      let manager = managers?.first ?? NETunnelProviderManager()
      let protocolConfiguration = NETunnelProviderProtocol()
      protocolConfiguration.providerBundleIdentifier = self.tunnelBundleId
      protocolConfiguration.serverAddress = "Headshy Node" 
      protocolConfiguration.providerConfiguration = ["serverConfig": config]
      
      manager.protocolConfiguration = protocolConfiguration
      manager.localizedDescription = "Headshy VPN"
      manager.isEnabled = true

      manager.saveToPreferences { error in
        if let error = error { reject("ERR", "Save error", error); return }
        manager.loadFromPreferences { error in
          if let error = error { reject("ERR", "Reload error", error); return }
          do {
            try manager.connection.startVPNTunnel()
            resolve(true)
          } catch {
            reject("ERR", "Start error", error)
          }
        }
      }
    }
  }

  @objc func stopVPN(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    NETunnelProviderManager.loadAllFromPreferences { managers, error in
      managers?.first?.connection.stopVPNTunnel()
      resolve(true)
    }
  }
  
  @objc static func requiresMainQueueSetup() -> Bool { return false }
}`;
      fs.writeFileSync(path.join(appTargetDir, 'VpnManager.swift'), swiftBridgeCode);

      const objcBridgeCode = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VpnManager, NSObject)
RCT_EXTERN_METHOD(startVPN:(NSString *)config resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopVPN:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
@end`;
      fs.writeFileSync(path.join(appTargetDir, 'VpnManager.m'), objcBridgeCode);

      // 4. Обновленный Ruby-скрипт (теперь он прописывает мост в Xcode)
      const rubyScript = `
require 'xcodeproj'
project_path = '${APP_NAME}.xcodeproj'
project = Xcodeproj::Project.open(project_path)
main_target = project.targets.find { |t| t.name == '${APP_NAME}' }

# -- Внедряем мост в главное приложение --
app_group = project.main_group.find_subpath('${APP_NAME}', true)
bridge_swift = app_group.new_file('VpnManager.swift')
main_target.source_build_phase.add_file_reference(bridge_swift)
bridge_m = app_group.new_file('VpnManager.m')
main_target.source_build_phase.add_file_reference(bridge_m)

# -- Создаем таргет туннеля --
ext_target = project.new_target(:app_extension, '${EXTENSION_NAME}', :ios, '14.0')
ext_target.product_reference.name = '${EXTENSION_NAME}.appex'
group = project.main_group.find_subpath('${EXTENSION_NAME}', true)
group.set_source_tree('<group>')
group.set_path('${EXTENSION_NAME}')

swift_file = group.new_file('PacketTunnelProvider.swift')
ext_target.source_build_phase.add_file_reference(swift_file)

ext_target.build_configurations.each do |c|
  c.build_settings['INFOPLIST_FILE'] = '${EXTENSION_NAME}/Info.plist'
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = '${bundleId}'
  c.build_settings['SWIFT_VERSION'] = '5.0'
  c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
end

framework_ref = project.frameworks_group.new_reference('System/Library/Frameworks/NetworkExtension.framework')
framework_ref.source_tree = 'SDKROOT'
ext_target.frameworks_build_phase.add_file_reference(framework_ref)

libbox_ref = group.new_file('Libbox.xcframework')
ext_target.frameworks_build_phase.add_file_reference(libbox_ref)

embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
embed_phase.name = 'Embed App Extensions'
embed_phase.symbolic_dst_subfolder_spec = :plug_ins
main_target.build_phases << embed_phase
file_ref = embed_phase.add_file_reference(ext_target.product_reference)
file_ref.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
main_target.add_dependency(ext_target)

project.save
puts '✅ Нативный мост и туннель успешно внедрены!'
`;
      fs.writeFileSync(path.join(iosPath, 'add_vpn_target.rb'), rubyScript);

      try {
        execSync('gem install xcodeproj --no-document && ruby add_vpn_target.rb', { cwd: iosPath, stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Ошибка интеграции:', error.message);
      }

      return config;
    },
  ]);
};

module.exports = withNetworkExtension;
