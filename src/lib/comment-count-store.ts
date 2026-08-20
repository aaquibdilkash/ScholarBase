import { useSyncExternalStore } from 'react';

type Listener = (count: number) => void;
let count = 0;
const listeners = new Set<Listener>();

export function emitCommentCount(c: number) {
  count = c;
  listeners.forEach((l) => l(c));
}

export function subscribeCommentCount(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCommentCount() {
  return count;
}

export function useCommentCount(initialCount: number) {
  return useSyncExternalStore(
    subscribeCommentCount,
    getCommentCount,
    () => initialCount,
  );
}
