/**
 * Auth Store (Zustand)
 * PIN-based authentication with lockout logic
 * Uses SHA-256 instead of bcrypt to avoid env var corruption (Vite dotenv mangles $ characters in bcrypt hashes)
 */

import { create } from 'zustand';
import {
  SESSION_KEY, PERSIST_KEY, PERSIST_EXPIRY_DAYS,
  MAX_PIN_ATTEMPTS, LOCKOUT_DURATION_MS,
} from '../lib/constants';

interface AuthState {
  isAuthenticated: boolean;
  failedAttempts: number;
  lockedUntil: number | null; // timestamp
  isLoading: boolean;
  
  // Actions
  verify: (pin: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => boolean;
  getRemainingLockout: () => number; // ms remaining
}

function getPinHash(): string {
  return (import.meta as any).env?.VITE_PIN_HASH || '';
}

/**
 * Hash a PIN using SHA-256 (Web Crypto API)
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  failedAttempts: 0,
  lockedUntil: null,
  isLoading: false,

  verify: async (pin: string): Promise<boolean> => {
    const state = get();

    // Check lockout
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      return false;
    }

    // Clear expired lockout
    if (state.lockedUntil && Date.now() >= state.lockedUntil) {
      set({ lockedUntil: null, failedAttempts: 0 });
    }

    set({ isLoading: true });

    try {
      const expectedHash = getPinHash();
      if (!expectedHash) {
        console.error('[Auth] No PIN hash configured');
        set({ isLoading: false });
        return false;
      }

      const inputHash = await sha256(pin);
      const match = inputHash === expectedHash;

      if (match) {
        // Success
        sessionStorage.setItem(SESSION_KEY, String(Date.now()));
        set({
          isAuthenticated: true,
          failedAttempts: 0,
          lockedUntil: null,
          isLoading: false,
        });
        return true;
      } else {
        // Failure
        const newAttempts = state.failedAttempts + 1;
        const shouldLock = newAttempts >= MAX_PIN_ATTEMPTS;
        set({
          failedAttempts: newAttempts,
          lockedUntil: shouldLock ? Date.now() + LOCKOUT_DURATION_MS : null,
          isLoading: false,
        });
        return false;
      }
    } catch (err) {
      console.error('[Auth] Verification error:', err);
      set({ isLoading: false });
      return false;
    }
  },

  logout: () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PERSIST_KEY);
    set({
      isAuthenticated: false,
      failedAttempts: 0,
      lockedUntil: null,
    });
  },

  checkSession: (): boolean => {
    // Check sessionStorage first (active session)
    const sessionTs = sessionStorage.getItem(SESSION_KEY);
    if (sessionTs) {
      set({ isAuthenticated: true });
      return true;
    }

    // Check localStorage (7-day persist)
    const persistTs = localStorage.getItem(PERSIST_KEY);
    if (persistTs) {
      const ts = parseInt(persistTs, 10);
      const expiryMs = PERSIST_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - ts < expiryMs) {
        sessionStorage.setItem(SESSION_KEY, String(Date.now()));
        set({ isAuthenticated: true });
        return true;
      } else {
        localStorage.removeItem(PERSIST_KEY);
      }
    }

    set({ isAuthenticated: false });
    return false;
  },

  getRemainingLockout: (): number => {
    const { lockedUntil } = get();
    if (!lockedUntil) return 0;
    return Math.max(0, lockedUntil - Date.now());
  },
}));

/**
 * Enable "Remember me" — persist auth to localStorage
 */
export function enablePersistence(): void {
  localStorage.setItem(PERSIST_KEY, String(Date.now()));
}

/**
 * Disable "Remember me"
 */
export function disablePersistence(): void {
  localStorage.removeItem(PERSIST_KEY);
}
