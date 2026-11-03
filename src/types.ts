/**
 * Sync lifecycle of a captured record.
 *
 *  pending  -> waiting to be pushed (new, or a retry is scheduled)
 *  syncing  -> a push is in flight right now
 *  synced   -> server acknowledged it
 *  failed   -> gave up (permanent error or max attempts); needs a manual retry
 */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type Category = 'Inspection' | 'Defect' | 'Progress' | 'Safety';

export const CATEGORIES: Category[] = ['Inspection', 'Defect', 'Progress', 'Safety'];

export interface CaptureRecord {
  /** Client-generated UUID. Doubles as the idempotency key on the server. */
  id: string;
  title: string;
  notes: string;
  category: Category;
  /** Local file:// URI inside the app's document directory, or null. */
  photoUri: string | null;
  createdAt: number;
  updatedAt: number;

  status: SyncStatus;
  attempts: number;
  /** Epoch ms when the next automatic attempt is allowed. */
  nextAttemptAt: number;
  lastError: string | null;
  syncedAt: number | null;
  remoteId: string | null;
}

export type NewCapture = Pick<CaptureRecord, 'title' | 'notes' | 'category' | 'photoUri'>;
