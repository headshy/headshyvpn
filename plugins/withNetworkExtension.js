const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Имя нашего будущего VPN-туннеля
const EXTENSION_NAME = 'HeadshyVPNTunnel';

const withNetworkExtension = (config) => {
  // 1. Копируем файлы расширения и ядро Sing-box в сгенерированную папку ios
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const extensionSourceDir = path.join(projectRoot, 'ios-extension');
      const iosDestinationDir = path.join(config.modRequest.platformProjectRoot, EXTENSION_NAME);

      if (!fs.existsSync(iosDestinationDir)) {
        fs.mkdirSync(iosDestinationDir, { recursive: true });
      }

      // Функция для рекурсивного копирования папки
      const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();
        if (isDirectory) {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest);
          fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
          });
        } else {
          fs.copyFileSync(src, dest);
        }
      };

      // Если папка с исходниками туннеля существует, копируем ее
      if (fs.existsSync(extensionSourceDir)) {
        copyRecursiveSync(extensionSourceDir, iosDestinationDir);
        console.log(`✅ Исходники туннеля скопированы в ${iosDestinationDir}`);
      } else {
        console.warn(`⚠️ Папка ios-extension не найдена! Создайте ее и положите туда libbox.xcframework`);
      }

      return config;
    },
  ]);

  // 2. Интегрируем расширение в Xcode проект (добавляем таргет)
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    
    // Здесь мы программно говорим Xcode: "Создай новый Target типа Network Extension, 
    // привяжи к нему Swift-файлы из папки HeadshyVPNTunnel и слинкуй libbox.xcframework"
    // (Детальную логику парсинга pbxproj добавим на следующем этапе, когда будут готовы Swift-файлы)
    
    console.log('✅ Xcode проект подготовлен для внедрения Network Extension');
    
    return config;
  });

  return config;
};

module.exports = withNetworkExtension;