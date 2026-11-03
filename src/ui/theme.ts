import type { SyncStatus } from '../types';

export const colors = {
  bg: '#F4F2EE',
  card: '#FFFFFF',
  ink: '#1C1B19',
  muted: '#6E6A63',
  line: '#E3DFD8',
  accent: '#E8590C',
  online: '#2F9E44',
  offline: '#C92A2A',
};

export const statusStyle: Record<SyncStatus, { label: string; fg: string; bg: string }> = {
  pending: { label: 'Pending', fg: '#8F5E00', bg: '#FFF3BF' },
  syncing: { label: 'Syncing', fg: '#1864AB', bg: '#D0EBFF' },
  synced: { label: 'Synced', fg: '#2B8A3E', bg: '#D3F9D8' },
  failed: { label: 'Failed', fg: '#C92A2A', bg: '#FFE3E3' },
};
