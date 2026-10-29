"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export interface AccessibilityPreferences {
  highContrast: boolean;
  legibleFont: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

export type AccessibilityPreferenceKey = keyof AccessibilityPreferences;

/**
 * Storage keys are intentionally unchanged from the original BYTEQUEST HUB
 * implementation so existing learners keep their saved preferences.
 */
export const ACCESSIBILITY_STORAGE_KEYS = {
  highContrast: "bytequest:a11y-contrast",
  legibleFont: "bytequest:a11y-font",
  largeText: "bytequest:a11y-scale",
  reducedMotion: "bytequest:a11y-motion",
} as const satisfies Record<AccessibilityPreferenceKey, string>;

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  legibleFont: false,
  largeText: false,
  reducedMotion: false,
};

let cachedPreferences: AccessibilityPreferences | null = null;
const preferenceListeners = new Set<() => void>();

function systemPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function readStoredPreferences(): AccessibilityPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  let contrast: string | null = null;
  let font: string | null = null;
  let scale: string | null = null;
  let motion: string | null = null;

  try {
    contrast = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEYS.highContrast);
    font = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEYS.legibleFont);
    scale = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEYS.largeText);
    motion = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEYS.reducedMotion);
  } catch {
    // localStorage can be unavailable (private mode, blocked storage, SSR).
  }

  return {
    highContrast: contrast === "true",
    legibleFont: font === "true",
    largeText: scale === "true",
    // Respect the operating-system preference until the learner makes an
    // explicit choice, matching the original drawer behaviour.
    reducedMotion:
      motion === null ? systemPrefersReducedMotion() : motion === "true",
  };
}

function applyPreferences(preferences: AccessibilityPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-contrast", preferences.highContrast ? "high" : "normal");
  root.setAttribute("data-scale", preferences.largeText ? "large" : "normal");
  root.setAttribute("data-font", preferences.legibleFont ? "legible" : "normal");
  root.setAttribute("data-motion", preferences.reducedMotion ? "reduced" : "normal");
}

function persistPreferences(preferences: AccessibilityPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEYS.highContrast,
      String(preferences.highContrast),
    );
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEYS.legibleFont,
      String(preferences.legibleFont),
    );
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEYS.largeText,
      String(preferences.largeText),
    );
    window.localStorage.setItem(
      ACCESSIBILITY_STORAGE_KEYS.reducedMotion,
      String(preferences.reducedMotion),
    );
  } catch {
    // Persisting is best-effort; the current session still reflects the choice.
  }
}

function getPreferencesSnapshot(): AccessibilityPreferences {
  if (!cachedPreferences) {
    cachedPreferences = readStoredPreferences();
  }
  return cachedPreferences;
}

function getPreferencesServerSnapshot(): AccessibilityPreferences {
  return DEFAULT_PREFERENCES;
}

function subscribeToPreferences(listener: () => void): () => void {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
}

function commitPreferences(nextPreferences: AccessibilityPreferences): void {
  cachedPreferences = nextPreferences;
  // Apply synchronously so the whole application updates on the same click.
  applyPreferences(nextPreferences);
  persistPreferences(nextPreferences);
  for (const listener of preferenceListeners) {
    listener();
  }
}

interface AccessibilityContextValue {
  preferences: AccessibilityPreferences;
  setPreference: (key: AccessibilityPreferenceKey, value: boolean) => void;
  togglePreference: (key: AccessibilityPreferenceKey) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const preferences = useSyncExternalStore(
    subscribeToPreferences,
    getPreferencesSnapshot,
    getPreferencesServerSnapshot,
  );

  // Re-apply after hydration and whenever preferences change. This keeps the
  // <html> data attributes authoritative even if another script mutates them.
  useEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  const setPreference = useCallback(
    (key: AccessibilityPreferenceKey, value: boolean) => {
      const current = getPreferencesSnapshot();
      if (current[key] === value) return;
      commitPreferences({ ...current, [key]: value });
    },
    [],
  );

  const togglePreference = useCallback((key: AccessibilityPreferenceKey) => {
    const current = getPreferencesSnapshot();
    commitPreferences({ ...current, [key]: !current[key] });
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({ preferences, setPreference, togglePreference }),
    [preferences, setPreference, togglePreference],
  );

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider.");
  }
  return context;
}
