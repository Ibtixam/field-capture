import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { syncEngine } from './src/sync/SyncEngine';
import type { SyncStatus } from './src/types';
import { CaptureModal } from './src/ui/CaptureModal';
import { RecordCard } from './src/ui/RecordCard';
import { colors, statusStyle } from './src/ui/theme';
import { useEngine, useNow } from './src/ui/useEngine';

const FAILURE_RATES = [0, 0.3, 0.7, 1];

export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}

function Home() {
  const s = useEngine();
  const now = useNow();
  const [capturing, setCapturing] = useState(false);
  const [devOpen, setDevOpen] = useState(false);

  useEffect(() => {
    void syncEngine.start();
  }, []);

  const counts = useMemo(() => {
    const c: Record<SyncStatus, number> = { pending: 0, syncing: 0, synced: 0, failed: 0 };
    s.records.forEach((r) => c[r.status]++);
    return c;
  }, [s.records]);

  const onRetry = useCallback((id: string) => void syncEngine.retry(id), []);
  const unsynced = counts.pending + counts.syncing + counts.failed;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Field Capture</Text>
          <Text style={styles.sub}>
            {unsynced === 0 ? 'Everything synced' : `${unsynced} not yet on server`}
            {s.draining ? ' · syncing…' : ''}
          </Text>
        </View>
        <Pressable onLongPress={() => setDevOpen((v) => !v)} onPress={() => setDevOpen((v) => !v)}>
          <View style={[styles.pill, { backgroundColor: s.online ? colors.online : colors.offline }]}>
            <View style={styles.dot} />
            <Text style={styles.pillText}>{s.online ? 'Online' : 'Offline'}</Text>
          </View>
        </Pressable>
      </View>

      {!s.online && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            No connection. New captures are saved on this device and will upload automatically when you're back
            online.
          </Text>
        </View>
      )}

      <View style={styles.counts}>
        {(Object.keys(counts) as SyncStatus[]).map((k) => (
          <View key={k} style={[styles.count, { backgroundColor: statusStyle[k].bg }]}>
            <Text style={[styles.countNum, { color: statusStyle[k].fg }]}>{counts[k]}</Text>
            <Text style={[styles.countLabel, { color: statusStyle[k].fg }]}>{statusStyle[k].label}</Text>
          </View>
        ))}
      </View>

      {devOpen && (
        <View style={styles.dev}>
          <Text style={styles.devTitle}>Demo controls</Text>
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>Simulate offline</Text>
            <Switch value={s.forceOffline} onValueChange={(v) => syncEngine.setForceOffline(v)} />
          </View>
          <Text style={styles.devMeta}>
            Device network: {s.networkOnline ? 'connected' : 'disconnected'} · Server: {s.transportName}
          </Text>
          {s.transportName === 'Mock server' && (
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Server failure rate</Text>
              <View style={styles.seg}>
                {FAILURE_RATES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => syncEngine.setFailureRate(r)}
                    style={[styles.segBtn, s.failureRate === r && styles.segOn]}
                  >
                    <Text style={[styles.segText, s.failureRate === r && styles.segTextOn]}>{r * 100}%</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <View style={styles.devRow}>
            <Pressable style={styles.devBtn} onPress={() => void syncEngine.syncNow()}>
              <Text style={styles.devBtnText}>Sync now</Text>
            </Pressable>
            <Pressable
              style={[styles.devBtn, styles.devBtnGhost]}
              onPress={() =>
                Alert.alert('Clear all captures?', 'Deletes local data and photos.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => void syncEngine.clearAll() },
                ])
              }
            >
              <Text style={[styles.devBtnText, { color: colors.offline }]}>Clear all</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={s.records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <RecordCard record={item} now={now} online={s.online} onRetry={onRetry} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No captures yet</Text>
            <Text style={styles.emptyText}>Tap + to record something on site. It works offline.</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => setCapturing(true)}>
        <Text style={styles.fabText}>+ New capture</Text>
      </Pressable>

      <CaptureModal visible={capturing} onClose={() => setCapturing(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '700' },
  banner: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FFE3E3', borderRadius: 12, padding: 12 },
  bannerText: { color: '#8A1C1C', fontSize: 13, lineHeight: 18 },
  counts: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  count: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  countNum: { fontSize: 20, fontWeight: '800' },
  countLabel: { fontSize: 11, fontWeight: '600' },
  dev: { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  devTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  devRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  devLabel: { fontSize: 15, color: colors.ink },
  devMeta: { fontSize: 12, color: colors.muted },
  seg: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontSize: 13, color: colors.ink },
  segTextOn: { color: '#fff', fontWeight: '700' },
  devBtn: { flex: 1, backgroundColor: colors.ink, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  devBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  devBtnText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 110 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  emptyText: { fontSize: 14, color: colors.muted },
  fab: { position: 'absolute', bottom: 34, alignSelf: 'center', backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
