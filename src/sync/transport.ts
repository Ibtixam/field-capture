import { File } from 'expo-file-system';
import type { CaptureRecord } from '../types';

/** Thrown by transports. `retryable` separates "try again later" from "this will never work". */
export class SyncError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface Transport {
  readonly name: string;
  push(record: CaptureRecord): Promise<{ remoteId: string }>;
}

/**
 * In-app fake backend so the prototype runs with zero setup.
 * Simulates latency, flaky 5xx responses, and server-side idempotency.
 */
export class MockTransport implements Transport {
  readonly name = 'Mock server';
  failureRate = 0.3;
  private seen = new Map<string, string>();

  async push(record: CaptureRecord) {
    await sleep(600 + Math.random() * 900);
    if (Math.random() < this.failureRate) {
      throw new SyncError('503 Service Unavailable (simulated)', true);
    }
    // Idempotent upsert: resending the same id returns the same remote id.
    let remoteId = this.seen.get(record.id);
    if (!remoteId) {
      remoteId = `srv_${this.seen.size + 1}`;
      this.seen.set(record.id, remoteId);
    }
    return { remoteId };
  }
}

/** Real HTTP transport. Enabled by setting EXPO_PUBLIC_SYNC_URL (see /server). */
export class HttpTransport implements Transport {
  readonly name: string;
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 15_000) {
    this.name = baseUrl;
  }

  async push(record: CaptureRecord) {
    const photoBase64 = record.photoUri ? await new File(record.photoUri).base64() : null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/captures/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': record.id },
        body: JSON.stringify({
          title: record.title,
          notes: record.notes,
          category: record.category,
          createdAt: record.createdAt,
          photoBase64,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      // Network failure or timeout: always worth retrying.
      throw new SyncError(controller.signal.aborted ? 'Request timed out' : 'Network error', true);
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) {
      const body = (await res.json()) as { remoteId: string };
      return { remoteId: body.remoteId };
    }
    const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
    throw new SyncError(`HTTP ${res.status}`, retryable);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
