import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Modal, TextInput, Alert, Text, SafeAreaView } from 'react-native';
import { List, Button, Card, Badge, ActivityIndicator, Divider, IconButton } from 'react-native-paper';
import axios from 'axios';

// Cambia questo con l'URL reale del tuo backend caricato (es. https://tua-api.com/api)
const BACKEND_URL = 'http://129.153.47.200:80/api'; 

export default function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [streamId, setStreamId] = useState('');
  const [activeStreams, setActiveStreams] = useState({}); // Mappa { URL: StreamID }

  useEffect(() => { fetchMatches(); }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/matches`);
      setMatches(res.data.matches);
    } catch (err) { 
      Alert.alert("Errore di Rete", "Impossibile connettersi al backend."); 
    }
    setLoading(false);
  };

  const startStream = async () => {
    if (!streamId) return Alert.alert("ID Mancante", "Inserisci uno Stream ID");
    try {
      await axios.post(`${BACKEND_URL}/trigger-action`, { stream_id: streamId, url: selectedUrl });
      setActiveStreams(prev => ({ ...prev, [selectedUrl]: streamId }));
      setModalVisible(false);
      setStreamId('');
      Alert.alert("🚀 Lanciato", "Workflow GitHub avviato correttamente.");
    } catch (err) { 
      Alert.alert("Errore Workflow", "Lancio fallito. Controlla il token GitHub sul server."); 
    }
  };

  const endStream = async (url) => {
    const id = activeStreams[url];
    try {
      await axios.post(`${BACKEND_URL}/stop-stream`, { stream_id: id });
      const newStreams = { ...activeStreams };
      delete newStreams[url];
      setActiveStreams(newStreams);
      Alert.alert("🛑 Terminato", `Il container sentinel-${id} è stato rimosso dalla VM.`);
    } catch (err) { 
      Alert.alert("Errore SSH", "Impossibile fermare lo stream sulla VM."); 
    }
  };

  const renderMatch = ({ item }) => (
    <Card style={styles.card}>
      <List.Accordion 
        title={item.match} 
        titleStyle={styles.matchTitle}
        // --- AGGIUNTA ORARIO QUI ---
        description={`Inizio programmato: ${item.time}`}
        descriptionStyle={styles.matchTime}
        left={p => <List.Icon {...p} icon="calendar-clock" color="#6200ee" />}
      >
        <Divider />
        {item.streams.map((s, i) => (
          <List.Accordion 
            key={i} 
            title={s.language} 
            style={styles.subList} 
            left={p => <List.Icon {...p} icon="translate" />}
          >
            <List.Item 
              title="Sniff & Deploy" 
              description={s.url}
              descriptionStyle={{fontSize: 11}}
              onPress={() => { setSelectedUrl(s.url); setModalVisible(true); }}
              right={p => <List.Icon {...p} icon="play-circle" color="#4CAF50" />}
            />
            
            {activeStreams[s.url] && (
              <View style={styles.liveContainer}>
                <View style={styles.row}>
                  <Badge style={styles.liveBadge}>LIVE</Badge>
                  <Text style={styles.idText}>Active ID: {activeStreams[s.url]}</Text>
                </View>
                <Button 
                  mode="contained" 
                  color="#D32F2F" 
                  onPress={() => endStream(s.url)}
                  icon="stop"
                  style={styles.endBtn}
                >
                  End Stream
                </Button>
              </View>
            )}
            <Divider />
          </List.Accordion>
        ))}
      </List.Accordion>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sentinel Dashboard</Text>
        <IconButton icon="refresh" onPress={fetchMatches} />
      </View>

      {loading ? (
        <ActivityIndicator animating={true} size="large" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={matches} 
          keyExtractor={(_, i) => i.toString()} 
          renderItem={renderMatch} 
          onRefresh={fetchMatches} 
          refreshing={loading}
          contentContainerStyle={{paddingBottom: 20}}
        />
      )}

      {/* Modal per inserimento Stream ID */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Inizializza Stream</Text>
            <Text style={styles.modalSub}>Inserisci un ID numerico per identificare il container sulla VM.</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Stream ID (es: 1, 10, 100...)" 
              value={streamId} 
              onChangeText={setStreamId} 
              keyboardType="numeric" 
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Button onPress={() => setModalVisible(false)} style={{flex: 1}}>Annulla</Button>
              <Button mode="contained" onPress={startStream} style={{flex: 1, marginLeft: 10}}>Avvia</Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#fff',
    elevation: 2
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  card: { marginHorizontal: 12, marginVertical: 6, borderRadius: 10, overflow: 'hidden' },
  matchTitle: { fontWeight: 'bold', fontSize: 16 },
  matchTime: { color: '#666', fontSize: 13, marginTop: 2 },
  subList: { backgroundColor: '#fcfcfc' },
  liveContainer: { 
    padding: 15, 
    backgroundColor: '#fff5f5', 
    borderLeftWidth: 4, 
    borderLeftColor: '#f44336',
    margin: 10,
    borderRadius: 5
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  liveBadge: { backgroundColor: '#f44336', fontWeight: 'bold' },
  idText: { marginLeft: 10, fontWeight: '600', color: '#f44336' },
  endBtn: { marginTop: 5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: 'white', padding: 25, borderRadius: 15, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  modalSub: { fontSize: 13, color: '#666', marginBottom: 20 },
  input: { borderBottomWidth: 2, borderColor: '#6200ee', padding: 12, marginBottom: 25, fontSize: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' }
});
