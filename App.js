import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Modal, TextInput, Alert, Text, SafeAreaView } from 'react-native';
import { List, Button, Card, Badge, ActivityIndicator, Divider, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACKEND_URL = 'http://129.153.47.200:80/api'; 

export default function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [streamId, setStreamId] = useState('');
  
  // activeStreams tiene traccia del mapping { URL: ID } per gli stream lanciati dall'app
  const [activeStreams, setActiveStreams] = useState({}); 
  // serverActiveIds tiene traccia di TUTTI gli ID accesi sulla VM (anche quelli non lanciati da qui)
  const [serverActiveIds, setServerActiveIds] = useState([]);

  useEffect(() => { 
    initialLoad();
  }, []);

  const initialLoad = async () => {
    await loadLocalState();
    await fetchMatches();
    await syncWithServer();
  };

  const loadLocalState = async () => {
    const saved = await AsyncStorage.getItem('@active_streams');
    if (saved) setActiveStreams(JSON.parse(saved));
  };

  // Sincronizza lo stato reale della VM
  const syncWithServer = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/active-streams`);
      setServerActiveIds(res.data.active_ids || []);
      
      // Pulizia locale: se un ID nel nostro storage non è più sul server, lo rimuoviamo
      setActiveStreams(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(url => {
          if (!res.data.active_ids.includes(updated[url])) {
            delete updated[url];
          }
        });
        AsyncStorage.setItem('@active_streams', JSON.stringify(updated));
        return updated;
      });
    } catch (e) { console.error("Sync error", e); }
  };

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/matches`);
      setMatches(res.data.matches);
    } catch (err) { Alert.alert("Errore", "Server non raggiungibile"); }
    setLoading(false);
  };

  const handleHealthCheck = async (url) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/check-health`, { url });
      Alert.alert("Health Check", `Stato: ${res.data.status.toUpperCase()}`);
    } catch (err) { Alert.alert("Errore", "Check fallito"); }
  };

  const startStream = async () => {
    try {
      await axios.post(`${BACKEND_URL}/trigger-action`, { stream_id: streamId, url: selectedUrl });
      const newActive = { ...activeStreams, [selectedUrl]: streamId };
      setActiveStreams(newActive);
      await AsyncStorage.setItem('@active_streams', JSON.stringify(newActive));
      setModalVisible(false);
      setStreamId('');
      syncWithServer(); // Rinfresca subito
    } catch (err) { Alert.alert("Errore", "Lancio fallito"); }
  };

  const endStream = async (id, url = null) => {
    try {
      await axios.post(`${BACKEND_URL}/stop-stream`, { stream_id: id });
      if (url) {
        const newActive = { ...activeStreams };
        delete newActive[url];
        setActiveStreams(newActive);
        await AsyncStorage.setItem('@active_streams', JSON.stringify(newActive));
      }
      syncWithServer(); // Forza rinfresco della lista server
    } catch (err) { Alert.alert("Errore", "Impossibile stoppare lo stream"); }
  };

  // RENDER SEZIONE GESTIONE (Stream realmente accesi sul server)
  const renderActiveManagement = () => {
    if (serverActiveIds.length === 0) return null;

    return (
      <Card style={[styles.card, { backgroundColor: '#e8f5e9' }]}>
        <List.Accordion title="📡 GESTIONE STREAM ATTIVI (VM)" left={p => <List.Icon {...p} icon="server" color="green" />}>
          {serverActiveIds.map((id) => {
            // Cerchiamo se questo ID corrisponde a un URL che conosciamo
            const knownUrl = Object.keys(activeStreams).find(key => activeStreams[key] === id);
            return (
              <List.Item
                key={id}
                title={`Stream ID: ${id}`}
                description={knownUrl || "Avviato esternamente / Manuale"}
                right={p => <IconButton icon="stop-circle" color="red" onPress={() => endStream(id, knownUrl)} />}
              />
            );
          })}
        </List.Accordion>
      </Card>
    );
  };

  const renderMatch = ({ item }) => (
    <Card style={styles.card}>
      <List.Accordion title={item.match} description={item.time} left={p => <List.Icon {...p} icon="calendar-clock" />}>
        {item.streams.map((s, i) => {
          const isLive = serverActiveIds.includes(activeStreams[s.url]);
          return (
            <React.Fragment key={i}>
              <View style={styles.streamRow}>
                <View style={{ flex: 1 }}>
                  <List.Item 
                    title={s.language} 
                    description={s.url} 
                    onPress={() => { setSelectedUrl(s.url); setModalVisible(true); }}
                    left={p => <List.Icon {...p} icon="play-circle" color={isLive ? "red" : "green"} />}
                  />
                </View>
                <IconButton icon="heart-pulse" color="blue" onPress={() => handleHealthCheck(s.url)} />
                {isLive && <Badge style={styles.liveBadge}>LIVE</Badge>}
              </View>
              {isLive && (
                <Button mode="outlined" onPress={() => endStream(activeStreams[s.url], s.url)} style={styles.endBtnInside}>
                  Stop Stream {activeStreams[s.url]}
                </Button>
              )}
              <Divider />
            </React.Fragment>
          );
        })}
      </List.Accordion>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sentinel Dashboard</Text>
        <IconButton icon="sync" onPress={() => { fetchMatches(); syncWithServer(); }} />
      </View>
      <FlatList 
        ListHeaderComponent={renderActiveManagement}
        data={matches} 
        renderItem={renderMatch} 
        keyExtractor={(_, i) => i.toString()} 
        onRefresh={initialLoad}
        refreshing={loading}
      />
      
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Avvia ID Stream</Text>
            <TextInput style={styles.input} placeholder="ID (es: 1)" value={streamId} onChangeText={setStreamId} keyboardType="numeric" />
            <Button mode="contained" onPress={startStream}>Lancia</Button>
            <Button onPress={() => setModalVisible(false)}>Chiudi</Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#fff', elevation: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  card: { margin: 8, borderRadius: 8 },
  streamRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  liveBadge: { backgroundColor: 'red', alignSelf: 'center', marginRight: 10 },
  endBtnInside: { margin: 10, borderColor: 'red' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  input: { borderBottomWidth: 1, marginBottom: 20, padding: 8 }
});
