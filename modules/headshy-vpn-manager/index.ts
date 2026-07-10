import { requireNativeModule } from 'expo-modules-core';

let HeadshyVpnManager: any = null;

try {
  HeadshyVpnManager = requireNativeModule('HeadshyVpnManager');
} catch (error) {
  console.warn('⚠️ Нативный модуль HeadshyVpnManager не найден!');
}

export async function startVPN(config: string) {
  if (!HeadshyVpnManager) throw new Error("Нативный модуль VPN не скомпилирован");
  return await HeadshyVpnManager.startVPN(config);
}

export async function stopVPN() {
  if (!HeadshyVpnManager) return;
  return await HeadshyVpnManager.stopVPN();
}
