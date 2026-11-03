import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE_DELAY_MS, MAX_ATTEMPTS, MAX_DELAY_MS, backoffDelay, decideAfterFailure } from '../src/sync/backoff.ts';

test('backoff grows exponentially and stays within [exp/2, exp]', () => {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
    assert.equal(backoffDelay(attempt, () => 0), exp / 2);
    assert.equal(backoffDelay(attempt, () => 1), exp);
  }
});

test('backoff is capped', () => {
  assert.ok(backoffDelay(50, () => 1) <= MAX_DELAY_MS);
});

test('retryable errors are retried until the attempt budget is spent', () => {
  const now = 1_000;
  for (let a = 1; a < MAX_ATTEMPTS; a++) {
    const d = decideAfterFailure(a, true, now, () => 0.5);
    assert.equal(d.kind, 'retry');
    if (d.kind === 'retry') assert.ok(d.nextAttemptAt > now);
  }
  assert.equal(decideAfterFailure(MAX_ATTEMPTS, true, now).kind, 'give-up');
});

test('permanent errors give up immediately', () => {
  assert.equal(decideAfterFailure(1, false, 0).kind, 'give-up');
});
