export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type Category = 'Inspection' | 'Defect' | 'Progress' | 'Safety';

export const CATEGORIES: Category[] = ['Inspection', 'Defect', 'Progress', 'Safety'];

export interface CaptureRecord {
  id: string;
  title: string;
  notes: string;
  category: Category;
  photoUri: string | null;
  createdAt: number;
  updatedAt: number;

  status: SyncStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  syncedAt: number | null;
  remoteId: string | null;
}

export type NewCapture = Pick<CaptureRecord, 'title' | 'notes' | 'category' | 'photoUri'>;
