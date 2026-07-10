import Foundation
import NetworkExtension
import React

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
}