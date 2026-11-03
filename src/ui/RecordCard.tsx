import { memo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_ATTEMPTS } from '../sync/backoff';
import type { CaptureRecord } from '../types';
import { colors, statusStyle } from './theme';

interface Props {
  record: CaptureRecord;
  now: number;
  online: boolean;
  onRetry: (id: string) => void;
}

function detailLine(r: CaptureRecord, now: number, online: boolean): string {
  switch (r.status) {
    case 'synced':
      return `Synced ${formatTime(r.syncedAt!)} · ${r.remoteId}`;
    case 'syncing':
      return `Uploading… attempt ${r.attempts}/${MAX_ATTEMPTS}`;
    case 'failed':
      return `Gave up after ${r.attempts} attempt${r.attempts === 1 ? '' : 's'}: ${r.lastError}`;
    case 'pending': {
      if (!online) return 'Saved on device · will sync when online';
      if (r.attempts > 0 && r.nextAttemptAt > now) {
        const s = Math.ceil((r.nextAttemptAt - now) / 1000);
        return `Retry in ${s}s (attempt ${r.attempts}/${MAX_ATTEMPTS} failed: ${r.lastError})`;
      }
      return 'Queued';
    }
  }
}

function RecordCardImpl({ record: r, now, online, onRetry }: Props) {
  const st = statusStyle[r.status];
  return (
    <View style={styles.card}>
      {r.photoUri ? (
        <Image source={{ uri: r.photoUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Text style={styles.thumbText}>{r.category[0]}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            {r.status === 'syncing' && <ActivityIndicator size="small" color={st.fg} style={styles.spin} />}
            <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {r.category} · {formatTime(r.createdAt)}
        </Text>
        {!!r.notes && <Text style={styles.notes} numberOfLines={2}>{r.notes}</Text>}
        <View style={styles.row}>
          <Text style={[styles.detail, r.status === 'failed' && { color: st.fg }]} numberOfLines={2}>
            {detailLine(r, now, online)}
          </Text>
          {r.status === 'failed' && (
            <Pressable onPress={() => onRetry(r.id)} style={styles.retry} hitSlop={8}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export const RecordCard = memo(RecordCardImpl);

const formatTime = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  thumbEmpty: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontSize: 24, fontWeight: '700', color: colors.muted },
  body: { flex: 1, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  notes: { fontSize: 13, color: colors.ink },
  detail: { flex: 1, fontSize: 12, color: colors.muted },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  spin: { transform: [{ scale: 0.6 }], marginLeft: -4, marginRight: -2, height: 14 },
  retry: { backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
