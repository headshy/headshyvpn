import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, NativeModules } from 'react-native';
import { generateSingboxConfig } from './utils/singboxParser'; // Убедись, что путь к парсеру верный

const { VpnManager } = NativeModules;

export default function App() {
  const [status, setStatus] = useState('Disconnected');
  const [currentServer, setCurrentServer] = useState({ rawLink: 'твоя_ссылка_подписки_сюда' });

  const handlePressOut = async () => {
    // 1. Проверка на наличие моста
    if (!VpnManager) {
      Alert.alert("Ошибка", "Мост VpnManager не найден. Проверь логи сборки Codemagic.");
      return;
    }

    // 2. Логика запуска
    if (status === 'Disconnected') {
      try {
        const jsonConfig = generateSingboxConfig(currentServer.rawLink);
        
        // Вызов нативного Swift-кода
        await VpnManager.startVPN(jsonConfig);
        
        setStatus('Connected');
        Alert.alert("Успех", "VPN запущен");
      } catch (e) {
        Alert.alert("Ошибка запуска", e.message || "Неизвестная ошибка");
      }
    } else {
      // Логика остановки
      try {
        await VpnManager.stopVPN();
        setStatus('Disconnected');
      } catch (e) {
        Alert.alert("Ошибка остановки", e.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>Статус: {status}</Text>
      <TouchableOpacity style={styles.button} onPress={handlePressOut}>
        <Text style={styles.buttonText}>
          {status === 'Disconnected' ? 'CONNECT' : 'DISCONNECT'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusText: { fontSize: 20, marginBottom: 20 },
  button: { backgroundColor: '#007AFF', padding: 20, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
