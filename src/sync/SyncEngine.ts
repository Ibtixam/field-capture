import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import * as db from '../db/database';
import { deleteAllPhotos } from '../media/photos';
import type { CaptureRecord } from '../types';
import { decideAfterFailure } from './backoff';
import { HttpTransport, MockTransport, SyncError, type Transport } from './transport';

export interface EngineSnapshot {
  records: CaptureRecord[];
  /** Device reports connectivity (NetInfo). */
  networkOnline: boolean;
  /** Demo switch to simulate offline on a simulator where airplane mode isn't available. */
  forceOffline: boolean;
  /** What the engine actually uses. */
  online: boolean;
  draining: boolean;
  lastDrainAt: number | null;
  transportName: string;
  failureRate: number;
}

type Listener = () => void;

/**
 * Drains the local queue to the server.
 *
 * - Single-flight: only one drain loop runs at a time, records go one by one, oldest first.
 * - Triggers: app start, new capture, reconnect, app foreground, scheduled backoff timer, manual.
 * - Every state change is written to SQLite before the UI is notified, so the UI is a view of disk.
 */
class SyncEngine {
  private listeners = new Set<Listener>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private transport: Transport;
  private mock: MockTransport | null = null;

  private snapshot: EngineSnapshot;

  constructor() {
    const url = process.env.EXPO_PUBLIC_SYNC_URL;
    if (url) {
      this.transport = new HttpTransport(url);
    } else {
      this.mock = new MockTransport();
      this.transport = this.mock;
    }
    this.snapshot = {
      records: [],
      networkOnline: false,
      forceOffline: false,
      online: false,
      draining: false,
      lastDrainAt: null,
      transportName: this.transport.name,
      failureRate: this.mock?.failureRate ?? 0,
    };
  }

  // ---- store plumbing (consumed via useSyncExternalStore) ----
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snapshot;
  private set(patch: Partial<EngineSnapshot>) {
    const next = { ...this.snapshot, ...patch };
    next.online = next.networkOnline && !next.forceOffline;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }
  private async refresh() {
    this.set({ records: await db.listCaptures() });
  }

  // ---- lifecycle ----
  async start() {
    if (this.started) return;
    this.started = true;
    await db.recoverInterrupted();
    await this.refresh();

    NetInfo.addEventListener(this.onNetInfo);
    this.onNetInfo(await NetInfo.fetch());

    AppState.addEventListener('change', (s) => {
      if (s === 'active') void this.drain();
    });
  }

  private onNetInfo = (state: NetInfoState) => {
    // isInternetReachable is null while unknown; only treat an explicit false as offline.
    const networkOnline = !!state.isConnected && state.isInternetReachable !== false;
    this.applyConnectivity(networkOnline, this.snapshot.forceOffline);
  };

  private async applyConnectivity(networkOnline: boolean, forceOffline: boolean) {
    const wasOnline = this.snapshot.online;
    this.set({ networkOnline, forceOffline });
    if (!wasOnline && this.snapshot.online) {
      // Reconnected: flush immediately instead of waiting out offline-era backoff.
      await db.makeAllPendingDue();
      await this.refresh();
      void this.drain();
    }
  }

  // ---- public actions ----
  async capture(rec: CaptureRecord) {
    await db.insertCapture(rec);
    await this.refresh();
    void this.drain();
  }

  async retry(id: string) {
    await db.requeue(id);
    await this.refresh();
    void this.drain();
  }

  async syncNow() {
    await db.makeAllPendingDue();
    await this.refresh();
    void this.drain();
  }

  setForceOffline(v: boolean) {
    void this.applyConnectivity(this.snapshot.networkOnline, v);
  }

  setFailureRate(v: number) {
    if (!this.mock) return;
    this.mock.failureRate = v;
    this.set({ failureRate: v });
  }

  async clearAll() {
    await db.deleteAll();
    deleteAllPhotos();
    await this.refresh();
  }

  // ---- the drain loop ----
  private async drain() {
    if (this.snapshot.draining || !this.snapshot.online) return;
    this.clearRetryTimer();
    this.set({ draining: true });
    try {
      while (this.snapshot.online) {
        const rec = await db.nextDue(Date.now());
        if (!rec) break;
        await this.pushOne(rec);
      }
    } finally {
      this.set({ draining: false, lastDrainAt: Date.now() });
      await this.scheduleNextRetry();
    }
  }

  private async pushOne(rec: CaptureRecord) {
    await db.markSyncing(rec.id);
    await this.refresh();
    const attempts = rec.attempts + 1;
    try {
      const { remoteId } = await this.transport.push(rec);
      await db.markSynced(rec.id, remoteId);
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError(String(e), true);
      // If we lost connectivity mid-request, don't burn an attempt on it.
      if (!this.snapshot.online) {
        await db.markRetry(rec.id, 0, 'Went offline during upload', true);
      } else {
        const decision = decideAfterFailure(attempts, err.retryable, Date.now());
        if (decision.kind === 'retry') await db.markRetry(rec.id, decision.nextAttemptAt, err.message);
        else await db.markFailed(rec.id, err.message);
      }
    }
    await this.refresh();
  }

  private async scheduleNextRetry() {
    if (!this.snapshot.online) return;
    const t = await db.earliestScheduledRetry();
    if (t == null) return;
    const delay = Math.max(250, t - Date.now());
    this.retryTimer = setTimeout(() => void this.drain(), delay);
  }

  private clearRetryTimer() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}

export const syncEngine = new SyncEngine();
