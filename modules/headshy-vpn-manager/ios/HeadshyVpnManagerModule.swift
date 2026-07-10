import ExpoModulesCore
import NetworkExtension

public class HeadshyVpnManagerModule: Module {
  
  // Идентификатор будущего процесса туннеля.
  // По правилам Apple он должен состоять из Bundle ID приложения + суффикс (например, .tunnel)
  private var tunnelBundleId: String {
      return Bundle.main.bundleIdentifier! + ".tunnel"
  }

  public func definition() -> ModuleDefinition {
    Name("HeadshyVpnManager")

    // Изменили на AsyncFunction, так как нам нужно дождаться ответа от пользователя
    AsyncFunction("startVPN") { (config: String, promise: Promise) in
      
      // 1. Ищем уже существующий VPN профиль от нашего приложения
      NETunnelProviderManager.loadAllFromPreferences { managers, error in
        if let error = error {
          promise.reject("VPN_LOAD_ERROR", "Ошибка загрузки настроек: \(error.localizedDescription)")
          return
        }

        // Берем старый профиль или создаем новый
        let manager = managers?.first ?? NETunnelProviderManager()
        
        // 2. Настраиваем протокол нашего туннеля
        let protocolConfiguration = NETunnelProviderProtocol()
        
        // Указываем, какой именно процесс (Extension) будет обрабатывать трафик
        protocolConfiguration.providerBundleIdentifier = self.tunnelBundleId
        
        // Имя сервера в настройках iOS
        protocolConfiguration.serverAddress = "Headshy Node" 
        
        // САМОЕ ВАЖНОЕ: Передаем ссылку (vless://...) внутрь туннеля
        protocolConfiguration.providerConfiguration = [
            "serverConfig": config
        ]

        manager.protocolConfiguration = protocolConfiguration
        manager.localizedDescription = "Headshy VPN" // Название в настройках iOS
        manager.isEnabled = true

        // 3. Сохраняем профиль (Именно здесь появится всплывающее окно iOS)
        manager.saveToPreferences { error in
          if let error = error {
            promise.reject("VPN_SAVE_ERROR", "Отменено пользователем или ошибка: \(error.localizedDescription)")
            return
          }

          // 4. По правилам Apple, после сохранения профиль нужно загрузить заново
          manager.loadFromPreferences { error in
            if let error = error {
              promise.reject("VPN_RELOAD_ERROR", "Ошибка перезагрузки: \(error.localizedDescription)")
              return
            }

            // 5. Даем команду на запуск процесса-туннеля
            do {
              try manager.connection.startVPNTunnel()
              print("⚡️ Headshy VPN: Туннель запущен!")
              promise.resolve(true)
            } catch {
              promise.reject("VPN_START_ERROR", "Ошибка запуска: \(error.localizedDescription)")
            }
          }
        }
      }
    }

    AsyncFunction("stopVPN") { (promise: Promise) in
      NETunnelProviderManager.loadAllFromPreferences { managers, error in
        guard let manager = managers?.first else {
          promise.resolve(true)
          return
        }
        // Останавливаем туннель
        manager.connection.stopVPNTunnel()
        print("⚡️ Headshy VPN: Туннель остановлен!")
        promise.resolve(true)
      }
    }
  }
}