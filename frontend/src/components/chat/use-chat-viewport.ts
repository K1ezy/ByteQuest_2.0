import { useEffect, useRef, useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 850px)";

function subscribeToBreakpoint(callback: () => void) {
  const query = window.matchMedia?.(MOBILE_QUERY);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
}

export function useCompactChatLayout() {
  return useSyncExternalStore(subscribeToBreakpoint, () => window.matchMedia?.(MOBILE_QUERY).matches ?? false, () => false);
}

/** The tab's visual viewport shrinks when the phone keyboard opens. */
export function useChatViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const element = ref.current;
    if (!viewport || !element) return;
    function sync() {
      if (!viewport || !element) return;
      element.style.setProperty("--chat-visible-height", viewport.height + "px");
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      element.style.setProperty("--chat-keyboard-inset", bottom + "px");
    }
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);
  return ref;
}
