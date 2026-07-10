import { requireNativeModule } from 'expo-modules-core';

// Подключаем нативный модуль по имени
const HeadshyVpnManager = requireNativeModule('HeadshyVpnManager');

export function startVPN(config: string) {
  return HeadshyVpnManager.startVPN(config);
}

export function stopVPN() {
  return HeadshyVpnManager.stopVPN();
}