import { useEffect, useState, useSyncExternalStore } from 'react';
import { syncEngine } from '../sync/SyncEngine';

export function useEngine() {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getSnapshot);
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
