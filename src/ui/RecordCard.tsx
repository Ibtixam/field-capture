import { Ionicons } from '@react-native-vector-icons/ionicons';
import { memo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_ATTEMPTS } from '../sync/backoff';
import type { CaptureRecord } from '../types';
import { categoryStyle, colors, shadow, statusStyle, timeAgo } from './theme';

interface Props {
  record: CaptureRecord;
  now: number;
  online: boolean;
  onRetry: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}

function detailLine(r: CaptureRecord, now: number, online: boolean): string {
  switch (r.status) {
    case 'synced':
      return `On server ${timeAgo(r.syncedAt!, now)} · ${r.remoteId}`;
    case 'syncing':
      return `Uploading · attempt ${r.attempts}/${MAX_ATTEMPTS}`;
    case 'failed':
      return `${r.lastError} · ${r.attempts} attempt${r.attempts === 1 ? '' : 's'}`;
    case 'pending': {
      if (!online) return 'Saved on device · uploads when back online';
      if (r.attempts > 0 && r.nextAttemptAt > now) {
        const s = Math.ceil((r.nextAttemptAt - now) / 1000);
        return `Retrying in ${s}s · attempt ${r.attempts}/${MAX_ATTEMPTS} failed (${r.lastError})`;
      }
      return 'Queued for upload';
    }
  }
}

function RecordCardImpl({ record: r, now, online, onRetry, onDelete }: Props) {
  const st = statusStyle[r.status];
  const cat = categoryStyle[r.category];
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        {r.photoUri ? (
          <Image source={{ uri: r.photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: cat.bg }]}>
            <Ionicons name={cat.icon} size={24} color={cat.fg} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {r.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.category, { color: cat.fg }]}>{r.category}</Text>
            <Text style={styles.meta}> · {timeAgo(r.createdAt, now)}</Text>
          </View>
          {!!r.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {r.notes}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          {r.status === 'syncing' ? (
            <ActivityIndicator size="small" color={st.fg} style={styles.spin} />
          ) : (
            <Ionicons name={st.icon} size={13} color={st.fg} />
          )}
          <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
        </View>
        <Text style={[styles.detail, r.status === 'failed' && { color: st.fg }]} numberOfLines={1}>
          {detailLine(r, now, online)}
        </Text>
        {r.status === 'failed' && (
          <Pressable onPress={() => onRetry(r.id)} style={styles.retry} hitSlop={8} accessibilityRole="button">
            <Ionicons name="refresh" size={13} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onDelete(r.id, r.title)}
          style={styles.delete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${r.title}`}
        >
          <Ionicons name="trash-outline" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

export const RecordCard = memo(RecordCardImpl);

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 14, gap: 12, boxShadow: shadow },
  top: { flexDirection: 'row', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.ink, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  category: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 13, color: colors.muted },
  notes: { fontSize: 14, color: colors.muted, lineHeight: 19, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  spin: { transform: [{ scale: 0.55 }], width: 13, height: 13 },
  detail: { flex: 1, fontSize: 12, color: colors.muted },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  delete: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
