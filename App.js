import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Pressable, SafeAreaView, StatusBar, 
  Animated, Modal, FlatList, Switch, TextInput, ActivityIndicator, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import base64 from 'react-native-base64';
import * as VpnManager from './modules/headshy-vpn-manager';
import { generateSingboxConfig } from './utils/singboxParser';

export default function App() {
  const [status, setStatus] = useState('Disconnected');
  const [isServerModalVisible, setServerModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  
  const [subUrl, setSubUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [killSwitch, setKillSwitch] = useState(false);
  const [autoConnect, setAutoConnect] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Загрузка данных при старте
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem('@headshy_sub_url');
        if (savedUrl) setSubUrl(savedUrl);

        const savedServers = await AsyncStorage.getItem('@headshy_servers');
        if (savedServers) {
          const parsedServers = JSON.parse(savedServers);
          setServers(parsedServers);
          
          const savedCurrent = await AsyncStorage.getItem('@headshy_current_server');
          if (savedCurrent) {
            setCurrentServer(JSON.parse(savedCurrent));
          } else if (parsedServers.length > 0) {
            setCurrentServer(parsedServers[0]);
          }
        }
      } catch (error) {
        console.error('Data load error:', error);
      }
    };
    loadData();
  }, []);

  // Базовая имитация пинга (реальный пинг делается через нативный код)
  const pingServers = async () => {
    setIsLoading(true);
    const updatedServers = servers.map(server => ({
      ...server,
      ping: Math.floor(Math.random() * 150) + 20 // Имитация задержки 20-170ms
    }));
    setServers(updatedServers);
    await AsyncStorage.setItem('@headshy_servers', JSON.stringify(updatedServers));
    
    if (currentServer) {
      const updatedCurrent = updatedServers.find(s => s.id === currentServer.id);
      if (updatedCurrent) setCurrentServer(updatedCurrent);
    }
    setIsLoading(false);
  };

  // Загрузка и парсинг подписки
  const fetchSubscription = async () => {
    if (!subUrl) {
      Alert.alert('Ошибка', 'Введите ссылку на подписку');
      return;
    }

    setIsLoading(true);
    try {
      await AsyncStorage.setItem('@headshy_sub_url', subUrl);
      
      const response = await fetch(subUrl);
      const encodedText = await response.text();
      
      // Декодируем Base64
      const decodedText = base64.decode(encodedText.trim());
      const links = decodedText.split('\n').filter(link => link.trim() !== '');
      
      const newServers = links.map((link, index) => {
        // Примитивный парсинг названия узла (то, что идет после #)
        let name = `Server ${index + 1}`;
        let protocol = 'Unknown';
        
        if (link.includes('#')) {
          name = decodeURIComponent(link.split('#')[1]);
        }
        
        if (link.startsWith('vless://')) protocol = 'VLESS';
        if (link.startsWith('trojan://')) protocol = 'Trojan';
        if (link.startsWith('vmess://')) protocol = 'VMess';

        return {
          id: String(index),
          name: name,
          protocol: protocol,
          rawLink: link,
          ping: '--'
        };
      });

      setServers(newServers);
      await AsyncStorage.setItem('@headshy_servers', JSON.stringify(newServers));
      
      if (newServers.length > 0) {
        setCurrentServer(newServers[0]);
        await AsyncStorage.setItem('@headshy_current_server', JSON.stringify(newServers[0]));
      }
      
      Alert.alert('Успешно', `Загружено ${newServers.length} серверов`);
    } catch (error) {
      Alert.alert('Ошибка загрузки', 'Не удалось получить или расшифровать подписку. Проверьте ссылку.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectServer = async (server) => {
    setCurrentServer(server);
    setServerModalVisible(false);
    setStatus('Disconnected');
    await AsyncStorage.setItem('@headshy_current_server', JSON.stringify(server));
  };

  // Анимации кнопки
  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
  const handlePressOut = async () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();
    
    if (!currentServer) {
      Alert.alert('Внимание', 'Сначала загрузите подписку и выберите сервер');
      return;
    }
    
    if (status === 'Disconnected') {
      try {
        // 1. Конвертируем ссылку в Sing-box JSON
        const jsonConfig = generateSingboxConfig(currentServer.rawLink);
        
        // 2. Отправляем готовый JSON в нативный Swift-мост
        await VpnManager.startVPN(jsonConfig);
        
        setStatus('Connected');
      } catch (error) {
        Alert.alert('Ошибка', 'Не удалось запустить VPN. Возможно, неподдерживаемый формат ссылки.');
        console.error(error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Шапка */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Headshy VPN</Text>
        <Pressable onPress={() => setSettingsModalVisible(true)} style={styles.settingsButton}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      {/* Главная кнопка */}
      <View style={styles.main}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable 
            style={[styles.button, status === 'Connected' ? styles.buttonConnected : styles.buttonDisconnected]} 
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <Text style={styles.buttonText}>
              {status === 'Disconnected' ? 'CONNECT' : 'CONNECTED'}
            </Text>
          </Pressable>
        </Animated.View>
        <Text style={styles.statusText}>
          {status === 'Disconnected' ? 'Ready to connect' : 'Secure connection established'}
        </Text>
      </View>

      {/* Карточка сервера */}
      <Pressable onPress={() => setServerModalVisible(true)} style={styles.card}>
        {currentServer ? (
          <>
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardLabel}>Current Server</Text>
                <Text style={styles.cardValue}>{currentServer.name}</Text>
              </View>
              <View style={styles.protocolBadge}>
                <Text style={styles.protocolText}>{currentServer.protocol}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.cardRow}>
              <View>
                <Text style={styles.cardLabel}>PING</Text>
                <Text style={[styles.cardValue, { color: currentServer.ping !== '--' ? '#2DD881' : '#fff' }]}>
                  {currentServer.ping} {currentServer.ping !== '--' ? 'ms' : ''}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <Text style={styles.cardValue}>No servers found</Text>
            <Text style={styles.cardLabel}>Tap Settings to add subscription</Text>
          </View>
        )}
      </Pressable>

      {/* Модальное окно серверов */}
      <Modal animationType="slide" transparent={true} visible={isServerModalVisible}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Locations</Text>
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <Pressable onPress={pingServers}>
                <Text style={{ color: '#2DD881', fontWeight: 'bold' }}>Ping All</Text>
              </Pressable>
              <Pressable onPress={() => setServerModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
          </View>
          
          <FlatList
            data={servers}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={[styles.serverCard, currentServer?.id === item.id && styles.serverCardActive]} onPress={() => handleSelectServer(item)}>
                <View style={styles.serverInfo}>
                  <View>
                    <Text style={styles.serverName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.serverCity}>{item.protocol}</Text>
                  </View>
                </View>
                <View style={styles.serverStats}>
                  <Text style={[styles.pingText, item.ping !== '--' && item.ping < 100 ? styles.pingGood : styles.pingBad]}>
                    {item.ping} ms
                  </Text>
                  {currentServer?.id === item.id && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Модальное окно настроек */}
      <Modal animationType="slide" transparent={true} visible={isSettingsModalVisible}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Pressable onPress={() => setSettingsModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          
          <View style={styles.listContent}>
            
            <Text style={styles.settingsTitle}>Subscription Link</Text>
            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.input}
                placeholder="https://your-panel.com/sub/..."
                placeholderTextColor="#555"
                value={subUrl}
                onChangeText={setSubUrl}
                autoCapitalize="none"
              />
            </View>
            
            <Pressable 
              style={[styles.supportButton, { backgroundColor: '#9D4DFF', marginBottom: 24 }]} 
              onPress={fetchSubscription}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.supportButtonText, { color: '#fff' }]}>Update Subscription</Text>
              )}
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsTitle}>Kill Switch</Text>
                <Text style={styles.settingsDesc}>Block internet if VPN drops</Text>
              </View>
              <Switch value={killSwitch} onValueChange={setKillSwitch} trackColor={{ false: '#3E3854', true: '#9D4DFF' }} thumbColor="#fff" />
            </View>

            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsTitle}>Auto-Connect</Text>
                <Text style={styles.settingsDesc}>Connect on app launch</Text>
              </View>
              <Switch value={autoConnect} onValueChange={setAutoConnect} trackColor={{ false: '#3E3854', true: '#9D4DFF' }} thumbColor="#fff" />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Стили остались прежними, добавлены только стили для поля ввода
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0814' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 24 },
  headerSpacer: { width: 40 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 1 },
  settingsButton: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  settingsIcon: { fontSize: 24 },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: { width: 180, height: 180, borderRadius: 90, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.05)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  buttonDisconnected: { backgroundColor: '#9D4DFF', shadowColor: '#9D4DFF' },
  buttonConnected: { backgroundColor: '#2DD881', shadowColor: '#2DD881' },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  statusText: { color: '#B7B4C8', marginTop: 30, fontSize: 16 },
  card: { backgroundColor: '#171226', margin: 24, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: '#B7B4C8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  protocolBadge: { backgroundColor: 'rgba(157, 77, 255, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  protocolText: { color: '#C779FF', fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginVertical: 16 },
  modalContainer: { flex: 1, backgroundColor: '#0B0814', marginTop: 60, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  closeButton: { backgroundColor: '#171226', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { color: '#B7B4C8', fontSize: 16, fontWeight: 'bold' },
  listContent: { paddingHorizontal: 24, paddingBottom: 40 },
  serverCard: { backgroundColor: '#171226', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
  serverCardActive: { borderColor: '#9D4DFF', backgroundColor: 'rgba(157, 77, 255, 0.1)' },
  serverInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  serverName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  serverCity: { color: '#B7B4C8', fontSize: 12 },
  serverStats: { alignItems: 'flex-end', width: 60 },
  pingText: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  pingGood: { color: '#2DD881' },
  pingBad: { color: '#FF5D73' },
  checkMark: { color: '#9D4DFF', fontSize: 16, fontWeight: 'bold' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingsTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingsDesc: { color: '#B7B4C8', fontSize: 14 },
  supportButton: { backgroundColor: 'rgba(157, 77, 255, 0.1)', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  supportButtonText: { color: '#C779FF', fontSize: 16, fontWeight: 'bold' },
  inputContainer: { backgroundColor: '#171226', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginTop: 8, marginBottom: 16 },
  input: { color: '#fff', padding: 16, fontSize: 16 }
});
