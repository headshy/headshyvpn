const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withNetworkExtension(config) {
  return withDangerousMod(config, ['ios', async (config) => {
    const iosPath = config.modRequest.platformProjectRoot;
    const targetPath = path.join(iosPath, 'HeadshyVPN');
    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });

    const swift = `import Foundation\nimport NetworkExtension\nimport React\n\n@objc(VpnManager)\nclass VpnManager: NSObject {\n  @objc func startVPN(_ config: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {\n    NETunnelProviderManager.loadAllFromPreferences { managers, _ in\n      let manager = managers?.first ?? NETunnelProviderManager()\n      manager.protocolConfiguration = NETunnelProviderProtocol()\n      manager.isEnabled = true\n      manager.saveToPreferences { _ in try? manager.connection.startVPNTunnel(); resolve(true) }\n    }\n  }\n  @objc func stopVPN(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) { resolve(true) }\n  @objc static func requiresMainQueueSetup() -> Bool { return true }\n}`;
    const objc = `#import <React/RCTBridgeModule.h>\n@interface RCT_EXTERN_MODULE(VpnManager, NSObject)\nRCT_EXTERN_METHOD(startVPN:(NSString *)config resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)\nRCT_EXTERN_METHOD(stopVPN:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)\n@end`;

    fs.writeFileSync(path.join(targetPath, 'VpnManager.swift'), swift);
    fs.writeFileSync(path.join(targetPath, 'VpnManager.m'), objc);
    return config;
  }]);
};
