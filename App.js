import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Pressable, 
  SafeAreaView, 
  StatusBar, 
  Animated, 
  Modal, 
  FlatList,
  Switch,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Серверы без флага Нидерландов согласно требованиям интерфейса
const SERVERS = [
  { id: '1', country: 'Germany', city: 'Frankfurt', flag: '🇩🇪', protocol: 'VLESS Reality', ping: 22, ip: '142.250.185.110' },
  { id: '2', country: 'Netherlands', city: 'Amsterdam', flag: '', protocol: 'Trojan', ping: 18, ip: '198.51.100.24' },
  { id: '3', country: 'Japan', city: 'Tokyo', flag: '🇯🇵', protocol: 'XHTTP', ping: 120, ip: '103.2.3.4' },
  { id: '4', country: 'Sweden', city: 'Stockholm', flag: '🇸🇪', protocol: 'VLESS Vision', ping: 35, ip: '192.0.2.146' },
];

export default function App() {
  const [status, setStatus] = useState('Disconnected');
  const [isServerModalVisible, setServerModalVisible] = useState(false);
  const [isSettingsModalVisible, setSettingsModalVisible] = useState(false);
  
  const [currentServer, setCurrentServer] = useState(SERVERS[0]);
  
  // Настройки
  const [killSwitch, setKillSwitch] = useState(false);
  const [autoConnect, setAutoConnect] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedServer = await AsyncStorage.getItem('@headshy_saved_server');
        if (savedServer) setCurrentServer(JSON.parse(savedServer));

        const savedKillSwitch = await AsyncStorage.getItem('@headshy_killswitch');
        if (savedKillSwitch) setKillSwitch(JSON.parse(savedKillSwitch));

        const savedAutoConnect = await AsyncStorage.getItem('@headshy_autoconnect');
        if (savedAutoConnect) setAutoConnect(JSON.parse(savedAutoConnect));
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    };
    loadData();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }).start();
    setStatus(status === 'Disconnected' ? 'Connected' : 'Disconnected');
  };

  const handleSelectServer = async (server) => {
    setCurrentServer(server);
    setServerModalVisible(false);
    setStatus('Disconnected');
    await AsyncStorage.setItem('@headshy_saved_server', JSON.stringify(server));
  };

  const toggleKillSwitch = async (value) => {
    setKillSwitch(value);
    await AsyncStorage.setItem('@headshy_killswitch', JSON.stringify(value));
  };

  const toggleAutoConnect = async (value) => {
    setAutoConnect(value);
    await AsyncStorage.setItem('@headshy_autoconnect', JSON.stringify(value));
  };

  const openSupport = () => {
    // Здесь можно указать ссылку на твоего Telegram-бота
    Linking.openURL('https://t.me/headshyvpnsupportbot');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Шапка с кнопкой настроек */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Headshy VPN</Text>
        <Pressable onPress={() => setSettingsModalVisible(true)} style={styles.settingsButton}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

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

      <Pressable onPress={() => setServerModalVisible(true)} style={styles.card}>
        <View style={styles.cardRow}>
          <View>
            <Text style={styles.cardLabel}>Current Server</Text>
            <Text style={styles.cardValue}>
              {currentServer.flag} {currentServer.country}, {currentServer.city}
            </Text>
          </View>
          <View style={styles.protocolBadge}>
            <Text style={styles.protocolText}>{currentServer.protocol}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardRow}>
          <View>
            <Text style={styles.cardLabel}>PING</Text>
            <Text style={[styles.cardValue, { color: status === 'Connected' ? '#2DD881' : '#fff' }]}>
              {status === 'Connected' ? `${currentServer.ping} ms` : '--'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.cardLabel}>IP ADDRESS</Text>
            <Text style={styles.cardValue}>
              {status === 'Connected' ? currentServer.ip : 'Hidden'}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Модальное окно списка серверов */}
      <Modal animationType="slide" transparent={true} visible={isServerModalVisible} onRequestClose={() => setServerModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Locations</Text>
            <Pressable onPress={() => setServerModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={SERVERS}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={[styles.serverCard, currentServer.id === item.id && styles.serverCardActive]} onPress={() => handleSelectServer(item)}>
                <View style={styles.serverInfo}>
                  {item.flag ? <Text style={styles.serverFlag}>{item.flag}</Text> : null}
                  <View>
                    <Text style={styles.serverName}>{item.country}</Text>
                    <Text style={styles.serverCity}>{item.city} • {item.protocol}</Text>
                  </View>
                </View>
                <View style={styles.serverStats}>
                  <Text style={[styles.pingText, item.ping < 50 ? styles.pingGood : styles.pingBad]}>{item.ping} ms</Text>
                  {currentServer.id === item.id && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Модальное окно настроек */}
      <Modal animationType="slide" transparent={true} visible={isSettingsModalVisible} onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <Pressable onPress={() => setSettingsModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>
          
          <View style={styles.listContent}>
            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsTitle}>Kill Switch</Text>
                <Text style={styles.settingsDesc}>Block internet if VPN drops</Text>
              </View>
              <Switch 
                value={killSwitch} 
                onValueChange={toggleKillSwitch}
                trackColor={{ false: '#3E3854', true: '#9D4DFF' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsTitle}>Auto-Connect</Text>
                <Text style={styles.settingsDesc}>Connect on app launch</Text>
              </View>
              <Switch 
                value={autoConnect} 
                onValueChange={toggleAutoConnect}
                trackColor={{ false: '#3E3854', true: '#9D4DFF' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.divider} />

            <Pressable style={styles.supportButton} onPress={openSupport}>
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  serverInfo: { flexDirection: 'row', alignItems: 'center' },
  serverFlag: { fontSize: 28, marginRight: 16 },
  serverName: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  serverCity: { color: '#B7B4C8', fontSize: 12 },
  serverStats: { alignItems: 'flex-end' },
  pingText: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  pingGood: { color: '#2DD881' },
  pingBad: { color: '#FF5D73' },
  checkMark: { color: '#9D4DFF', fontSize: 16, fontWeight: 'bold' },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingsTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  settingsDesc: { color: '#B7B4C8', fontSize: 14 },
  supportButton: { backgroundColor: 'rgba(157, 77, 255, 0.1)', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  supportButtonText: { color: '#C779FF', fontSize: 16, fontWeight: 'bold' }
});