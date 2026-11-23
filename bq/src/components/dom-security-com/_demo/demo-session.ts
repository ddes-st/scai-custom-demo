'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  DEMO_PROFILE,
  type DemoAudience,
  type DemoProfile,
  isValidDemoLogin,
} from './demo-account';

const STORAGE_KEY = 'dom-security-demo-session';

export type DemoSessionState = {
  isLoggedIn: boolean;
  audience: DemoAudience;
  profile: DemoProfile | null;
};

const DEFAULT_STATE: DemoSessionState = {
  isLoggedIn: false,
  audience: 'customer',
  profile: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function readStorage(): DemoSessionState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<DemoSessionState>;
    const audience: DemoAudience =
      parsed.audience === 'professional' ? 'professional' : 'customer';
    if (parsed.isLoggedIn) {
      return {
        isLoggedIn: true,
        audience,
        profile: DEMO_PROFILE,
      };
    }
    return {
      isLoggedIn: false,
      audience,
      profile: null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

let cachedSnapshot: DemoSessionState = DEFAULT_STATE;
let hydrated = false;

function getSnapshot(): DemoSessionState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  if (!hydrated) {
    cachedSnapshot = readStorage();
    hydrated = true;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): DemoSessionState {
  return DEFAULT_STATE;
}

function writeState(next: DemoSessionState) {
  cachedSnapshot = next;
  hydrated = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          isLoggedIn: next.isLoggedIn,
          audience: next.audience,
        }),
      );
    } catch {
      /* ignore quota / private mode */
    }
  }
  emitChange();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDemoSession(): DemoSessionState {
  return getSnapshot();
}

export function loginDemo(email: string, password: string): boolean {
  if (!isValidDemoLogin(email, password)) return false;
  const current = getSnapshot();
  writeState({
    isLoggedIn: true,
    audience: current.audience,
    profile: DEMO_PROFILE,
  });
  return true;
}

export function logoutDemo(): void {
  const current = getSnapshot();
  writeState({
    isLoggedIn: false,
    audience: current.audience,
    profile: null,
  });
}

export function setDemoAudience(audience: DemoAudience): void {
  const current = getSnapshot();
  writeState({
    ...current,
    audience,
    profile: current.isLoggedIn ? DEMO_PROFILE : null,
  });
}

export function useDemoSession() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((email: string, password: string) => loginDemo(email, password), []);
  const logout = useCallback(() => logoutDemo(), []);
  const setAudience = useCallback((audience: DemoAudience) => setDemoAudience(audience), []);

  return {
    ...session,
    login,
    logout,
    setAudience,
  };
}
