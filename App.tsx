import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { syncEngine } from './src/sync/SyncEngine';
import type { SyncStatus } from './src/types';
import { CaptureModal } from './src/ui/CaptureModal';
import { RecordCard } from './src/ui/RecordCard';
import { colors, shadow, statusStyle } from './src/ui/theme';
import { useEngine, useNow } from './src/ui/useEngine';

const FAILURE_RATES = [0, 0.3, 0.7, 1];
const STATUSES: SyncStatus[] = ['pending', 'syncing', 'synced', 'failed'];

const confirmClearAll = () =>
  Alert.alert('Delete all captures?', 'This removes every capture and photo from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete all', style: 'destructive', onPress: () => void syncEngine.clearAll() },
  ]);

const confirmDelete = (id: string, title: string) =>
  Alert.alert(`Delete "${title}"?`, 'This removes the capture and its photo from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void syncEngine.remove(id) },
  ]);

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
  const insets = useSafeAreaInsets();
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
  const total = s.records.length;
  const queued = counts.pending + counts.syncing;
  const progress = total ? counts.synced / total : 0;

  const summary =
    total === 0
      ? { icon: 'cloud-done-outline' as const, title: 'Ready to capture', sub: 'Saved on device first, then synced.' }
      : !s.online && queued + counts.failed > 0
        ? { icon: 'cloud-offline-outline' as const, title: `${queued + counts.failed} saved on device`, sub: 'Will upload automatically when back online.' }
        : queued > 0
          ? { icon: 'cloud-upload-outline' as const, title: `${queued} waiting to upload`, sub: s.draining ? 'Syncing now…' : `${counts.synced} of ${total} on the server.` }
          : counts.failed > 0
            ? { icon: 'alert-circle-outline' as const, title: `${counts.failed} need${counts.failed === 1 ? 's' : ''} attention`, sub: 'Tap Retry on the record to send it again.' }
            : { icon: 'cloud-done-outline' as const, title: 'All caught up', sub: `${total} record${total === 1 ? '' : 's'} safely on the server.` };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      <FlatList
        data={s.records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <RecordCard record={item} now={now} online={s.online} onRetry={onRetry} onDelete={confirmDelete} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.header}>
              <View style={styles.flex}>
                <Text style={styles.overline}>
                  {new Date(now).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
                <Text style={styles.h1}>Field Capture</Text>
              </View>
              <Pressable
                onPress={() => setDevOpen(true)}
                style={[styles.pill, { backgroundColor: s.online ? colors.onlineSoft : colors.offlineSoft }]}
                accessibilityRole="button"
                accessibilityLabel={`${s.online ? 'Online' : 'Offline'}. Open demo controls`}
              >
                <View style={[styles.dot, { backgroundColor: s.online ? colors.online : colors.offline }]} />
                <Text style={[styles.pillText, { color: s.online ? colors.online : colors.offline }]}>
                  {s.online ? 'Online' : 'Offline'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryTop}>
                <View style={styles.summaryIcon}>
                  <Ionicons name={summary.icon} size={24} color={colors.accent} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.summaryTitle}>{summary.title}</Text>
                  <Text style={styles.summarySub}>{summary.sub}</Text>
                </View>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={styles.stats}>
                {STATUSES.map((k) => (
                  <View key={k} style={styles.stat}>
                    <Text style={styles.statNum}>{counts[k]}</Text>
                    <View style={styles.statLabelRow}>
                      <View style={[styles.statDot, { backgroundColor: statusStyle[k].fg }]} />
                      <Text style={styles.statLabel}>{statusStyle[k].label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {!s.online && (
              <View style={styles.banner}>
                <Ionicons name="cloud-offline-outline" size={20} color={colors.offline} />
                <View style={styles.flex}>
                  <Text style={styles.bannerTitle}>You're offline</Text>
                  <Text style={styles.bannerText}>Keep capturing. Everything uploads when you reconnect.</Text>
                </View>
              </View>
            )}

            {total > 0 && (
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Recent captures</Text>
                <Text style={styles.sectionCount}>{total}</Text>
                <Pressable
                  onPress={confirmClearAll}
                  hitSlop={8}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Delete all captures"
                >
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={styles.clearText}>Clear all</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="clipboard-outline" size={30} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No captures yet</Text>
            <Text style={styles.emptyText}>
              Log an inspection, defect, progress update or safety note. It works with no signal.
            </Text>
          </View>
        }
      />

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setCapturing(true)}
        accessibilityRole="button"
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.fabText}>New capture</Text>
      </Pressable>

      <CaptureModal visible={capturing} onClose={() => setCapturing(false)} />
      <DemoControls visible={devOpen} onClose={() => setDevOpen(false)} />
    </SafeAreaView>
  );
}

function DemoControls({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useEngine();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close demo controls" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Demo controls</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.devRow}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.muted} />
          <Text style={styles.devLabel}>Simulate offline</Text>
          <Switch
            value={s.forceOffline}
            onValueChange={(v) => syncEngine.setForceOffline(v)}
            trackColor={{ true: colors.accent, false: colors.line }}
          />
        </View>
        <Text style={styles.devMeta}>
          Device network: {s.networkOnline ? 'connected' : 'disconnected'} · Server: {s.transportName}
        </Text>

        {s.transportName === 'Mock server' && (
          <>
            <View style={styles.devRow}>
              <Ionicons name="server-outline" size={20} color={colors.muted} />
              <Text style={styles.devLabel}>Server failure rate</Text>
            </View>
            <View style={styles.seg}>
              {FAILURE_RATES.map((r) => {
                const on = s.failureRate === r;
                return (
                  <Pressable key={r} onPress={() => syncEngine.setFailureRate(r)} style={[styles.segBtn, on && styles.segOn]}>
                    <Text style={[styles.segText, on && styles.segTextOn]}>{r * 100}%</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.devButtons}>
          <Pressable style={styles.devBtn} onPress={() => void syncEngine.syncNow()}>
            <Ionicons name="sync-outline" size={18} color="#fff" />
            <Text style={styles.devBtnText}>Sync now</Text>
          </Pressable>
          <Pressable
            style={[styles.devBtn, styles.devBtnGhost]}
            onPress={confirmClearAll}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.devBtnText, { color: colors.danger }]}>Clear all</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { paddingHorizontal: 16 },
  headerWrap: { gap: 16, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  overline: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  h1: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -0.8, marginTop: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontWeight: '700', fontSize: 14 },

  summary: { backgroundColor: colors.card, borderRadius: 22, padding: 18, gap: 16, boxShadow: shadow },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 19, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  summarySub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.online },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },

  banner: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.offlineSoft, borderRadius: 16, padding: 14 },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: colors.offline },
  bannerText: { fontSize: 13, color: '#7A4A00', marginTop: 1, lineHeight: 18 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  section: { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  clearBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF5F5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  clearText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  sectionCount: { fontSize: 13, fontWeight: '700', color: colors.muted, backgroundColor: colors.line, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: colors.ink },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },

  fab: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingLeft: 20,
    paddingRight: 24,
    paddingVertical: 16,
    boxShadow: '0px 8px 24px rgba(232, 89, 12, 0.35)',
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(22, 24, 29, 0.4)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  devLabel: { flex: 1, fontSize: 16, color: colors.ink },
  devMeta: { fontSize: 13, color: colors.muted, marginTop: -6, marginLeft: 30 },
  seg: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 12, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segOn: { backgroundColor: colors.card, boxShadow: shadow },
  segText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  segTextOn: { color: colors.ink },
  devButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  devBtn: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: colors.ink, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  devBtnGhost: { backgroundColor: '#FFF5F5' },
  devBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
