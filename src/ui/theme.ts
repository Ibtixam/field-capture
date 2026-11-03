import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import type { Category, SyncStatus } from '../types';

export const colors = {
  bg: '#F5F4F0',
  card: '#FFFFFF',
  ink: '#16181D',
  muted: '#6B6F76',
  faint: '#A3A6AB',
  line: '#E8E6E1',
  accent: '#E8590C',
  accentSoft: '#FFF0E6',
  online: '#2B8A3E',
  onlineSoft: '#EBFBEE',
  offline: '#B35C00',
  offlineSoft: '#FFF4E0',
  danger: '#C92A2A',
};

export const shadow = '0px 1px 2px rgba(22, 24, 29, 0.04), 0px 4px 14px rgba(22, 24, 29, 0.06)';

export const statusStyle: Record<SyncStatus, { label: string; fg: string; bg: string; icon: IoniconsIconName }> = {
  pending: { label: 'Pending', fg: '#B35C00', bg: '#FFF4E0', icon: 'time-outline' },
  syncing: { label: 'Syncing', fg: '#1864AB', bg: '#E7F5FF', icon: 'cloud-upload-outline' },
  synced: { label: 'Synced', fg: '#2B8A3E', bg: '#EBFBEE', icon: 'checkmark-circle' },
  failed: { label: 'Failed', fg: '#C92A2A', bg: '#FFF5F5', icon: 'alert-circle' },
};

export const categoryStyle: Record<Category, { fg: string; bg: string; icon: IoniconsIconName }> = {
  Inspection: { fg: '#3B5BDB', bg: '#EDF2FF', icon: 'clipboard-outline' },
  Defect: { fg: '#D9480F', bg: '#FFF4E6', icon: 'warning-outline' },
  Progress: { fg: '#0B7285', bg: '#E3FAFC', icon: 'trending-up-outline' },
  Safety: { fg: '#862E9C', bg: '#F8F0FC', icon: 'shield-checkmark-outline' },
};

export function timeAgo(t: number, now: number): string {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
