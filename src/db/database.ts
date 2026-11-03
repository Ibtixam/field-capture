import * as SQLite from 'expo-sqlite';
import type { CaptureRecord, Category, SyncStatus } from '../types';

/**
 * Local-first store. SQLite is the source of truth: the UI reads from here and the
 * sync engine drains rows from here, so nothing is lost if the app is killed mid-sync.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_VERSION = 1;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

async function open() {
  const db = await SQLite.openDatabaseAsync('field-capture.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS captures (
        id              TEXT PRIMARY KEY NOT NULL,
        title           TEXT NOT NULL,
        notes           TEXT NOT NULL DEFAULT '',
        category        TEXT NOT NULL,
        photo_uri       TEXT,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        attempts        INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT,
        synced_at       INTEGER,
        remote_id       TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_captures_queue ON captures (status, next_attempt_at);
      PRAGMA user_version = ${SCHEMA_VERSION};
    `);
  }
  return db;
}

interface Row {
  id: string;
  title: string;
  notes: string;
  category: string;
  photo_uri: string | null;
  created_at: number;
  updated_at: number;
  status: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  synced_at: number | null;
  remote_id: string | null;
}

const toRecord = (r: Row): CaptureRecord => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  category: r.category as Category,
  photoUri: r.photo_uri,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  status: r.status as SyncStatus,
  attempts: r.attempts,
  nextAttemptAt: r.next_attempt_at,
  lastError: r.last_error,
  syncedAt: r.synced_at,
  remoteId: r.remote_id,
});

export async function insertCapture(rec: CaptureRecord) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO captures (id, title, notes, category, photo_uri, created_at, updated_at,
       status, attempts, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0)`,
    rec.id, rec.title, rec.notes, rec.category, rec.photoUri, rec.createdAt, rec.updatedAt,
  );
}

export async function listCaptures(): Promise<CaptureRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM captures ORDER BY created_at DESC');
  return rows.map(toRecord);
}

/** Oldest due record first, so the server receives captures in the order they were taken. */
export async function nextDue(now: number): Promise<CaptureRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT * FROM captures WHERE status = 'pending' AND next_attempt_at <= ?
     ORDER BY created_at ASC LIMIT 1`,
    now,
  );
  return row ? toRecord(row) : null;
}

export async function earliestScheduledRetry(): Promise<number | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ t: number | null }>(
    `SELECT MIN(next_attempt_at) AS t FROM captures WHERE status = 'pending'`,
  );
  return row?.t ?? null;
}

export async function markSyncing(id: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE captures SET status = 'syncing', attempts = attempts + 1, updated_at = ? WHERE id = ?`,
    Date.now(), id,
  );
}

export async function markSynced(id: string, remoteId: string) {
  const db = await getDb();
  const now = Date.now();
  await db.runAsync(
    `UPDATE captures SET status = 'synced', synced_at = ?, remote_id = ?, last_error = NULL,
       updated_at = ? WHERE id = ?`,
    now, remoteId, now, id,
  );
}

/** refundAttempt: the failure wasn't the server's fault (we went offline), so don't count it. */
export async function markRetry(id: string, nextAttemptAt: number, error: string, refundAttempt = false) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE captures SET status = 'pending', next_attempt_at = ?, last_error = ?, updated_at = ?,
       attempts = MAX(0, attempts - ?)
     WHERE id = ?`,
    nextAttemptAt, error, Date.now(), refundAttempt ? 1 : 0, id,
  );
}

export async function markFailed(id: string, error: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE captures SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`,
    error, Date.now(), id,
  );
}

/** Manual retry from the UI: back to the queue, fresh attempt budget, due now. */
export async function requeue(id: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE captures SET status = 'pending', attempts = 0, next_attempt_at = 0, updated_at = ?
     WHERE id = ?`,
    Date.now(), id,
  );
}

/** On reconnect, don't make the user wait out a backoff that was computed while offline. */
export async function makeAllPendingDue() {
  const db = await getDb();
  await db.runAsync(`UPDATE captures SET next_attempt_at = 0 WHERE status = 'pending'`);
}

/**
 * Crash recovery: a row left in 'syncing' means the app died mid-request.
 * Put it back in the queue. The server dedupes by id, so a resend is safe.
 */
export async function recoverInterrupted() {
  const db = await getDb();
  await db.runAsync(`UPDATE captures SET status = 'pending', next_attempt_at = 0 WHERE status = 'syncing'`);
}

export async function deleteAll() {
  const db = await getDb();
  await db.runAsync('DELETE FROM captures');
}
