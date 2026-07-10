const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_NAME = 'HeadshyVPNTunnel';

const withNetworkExtension = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, 'ios');
      const extensionSourceDir = path.join(projectRoot, 'ios-extension');
      const iosDestinationDir = path.join(iosPath, EXTENSION_NAME);

      // 1. Создаем папку и копируем файлы (PacketTunnelProvider.swift и скачанный libbox)
      if (!fs.existsSync(iosDestinationDir)) {
        fs.mkdirSync(iosDestinationDir, { recursive: true });
      }

      const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        if (exists && stats.isDirectory()) {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest);
          fs.readdirSync(src).forEach((child) => copyRecursiveSync(path.join(src, child), path.join(dest, child)));
        } else {
          fs.copyFileSync(src, dest);
        }
      };

      if (fs.existsSync(extensionSourceDir)) {
        copyRecursiveSync(extensionSourceDir, iosDestinationDir);
      }

      // 2. Генерируем Info.plist для VPN туннеля
      // Идентификатор обязан содержать суффикс, например .tunnel
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

      // 3. Создаем Ruby-скрипт для идеальной интеграции в .pbxproj
      const rubyScript = `
require 'xcodeproj'

project_path = 'HeadshyVPN.xcodeproj'
project = Xcodeproj::Project.open(project_path)
main_target = project.targets.find { |t| t.name == 'HeadshyVPN' }

# Создаем таргет расширения
ext_target = project.new_target(:app_extension, '${EXTENSION_NAME}', :ios, '14.0')
ext_target.product_reference.name = '${EXTENSION_NAME}.appex'

# Создаем виртуальную группу в Xcode и привязываем папку
group = project.main_group.find_subpath('${EXTENSION_NAME}', true)
group.set_source_tree('<group>')
group.set_path('${EXTENSION_NAME}')

# Добавляем Swift-файл туннеля
swift_file = group.new_file('PacketTunnelProvider.swift')
ext_target.source_build_phase.add_file_reference(swift_file)

# Прописываем настройки компиляции
ext_target.build_configurations.each do |c|
  c.build_settings['INFOPLIST_FILE'] = '${EXTENSION_NAME}/Info.plist'
  c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = '${bundleId}'
  c.build_settings['SWIFT_VERSION'] = '5.0'
  c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
end

# Линкуем системный фреймворк NetworkExtension
framework_ref = project.frameworks_group.new_reference('System/Library/Frameworks/NetworkExtension.framework')
framework_ref.source_tree = 'SDKROOT'
ext_target.frameworks_build_phase.add_file_reference(framework_ref)

# Линкуем наше скачанное ядро Libbox
libbox_ref = group.new_file('Libbox.xcframework')
ext_target.frameworks_build_phase.add_file_reference(libbox_ref)

# Самое важное: встраиваем (Embed) собранный туннель в главное приложение
embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
embed_phase.name = 'Embed App Extensions'
embed_phase.symbolic_dst_subfolder_spec = :plug_ins
main_target.build_phases << embed_phase
file_ref = embed_phase.add_file_reference(ext_target.product_reference)
file_ref.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
main_target.add_dependency(ext_target)

project.save
puts '✅ Network Extension успешно внедрен в Xcode проект!'
`;
      
      const scriptPath = path.join(iosPath, 'add_vpn_target.rb');
      fs.writeFileSync(scriptPath, rubyScript);

      // 4. Запускаем Ruby скрипт прямо во время Prebuild
      try {
        console.log('⚡️ Вызов Xcodeproj для модификации таргетов...');
        // Устанавливаем xcodeproj на случай, если его нет в окружении, и запускаем скрипт
        execSync('gem install xcodeproj --no-document && ruby add_vpn_target.rb', { cwd: iosPath, stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Ошибка интеграции таргета VPN:', error.message);
      }

      return config;
    },
  ]);
};

module.exports = withNetworkExtension;
