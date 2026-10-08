/**
 * Bring-your-own-key storage for the deployed (static) build.
 *
 * The visitor's Gemini API key lives only in their own browser — never in the
 * repo, the bundle or any server of ours. By default it is kept for the tab's
 * session only (sessionStorage); the visitor can opt in to remembering it
 * across visits (localStorage). It is only ever sent to Google's Gemini API.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "crane-game-gemini-key";

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): string {
  try {
    return (
      window.sessionStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(STORAGE_KEY) ??
      ""
    );
  } catch {
    return "";
  }
}

let cached = typeof window === "undefined" ? "" : read();

function emit() {
  cached = read();
  for (const l of listeners) l();
}

export function getApiKey(): string {
  return cached;
}

/** True when the key was stored for later visits (localStorage), not just this tab. */
export function isKeyPersisted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function setApiKey(key: string, persist: boolean): void {
  const trimmed = key.trim();
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
    if (trimmed) {
      (persist ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    // storage blocked (private mode etc.) — fall through; nothing is kept.
  }
  emit();
}

export function clearApiKey(): void {
  setApiKey("", false);
}

function subscribeKey(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** React hook: the current key (or "" when none). */
export function useApiKey(): string {
  return useSyncExternalStore(subscribeKey, getApiKey, () => "");
}
