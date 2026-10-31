"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastApi {
  show: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Safe no-op outside a provider (e.g. in unit tests) so callers never crash. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => {} };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((text: string, tone: ToastTone = "info") => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((list) => [...list, { id, tone, text }]);
    window.setTimeout(() => {
      dismiss(id);
    }, 3200);
  }, [dismiss]);

  // Rendering null on the server and until the first toast keeps the client's
  // initial output identical to the server's, so there is no hydration mismatch.
  const overlay =
    typeof document !== "undefined" && toasts.length > 0
      ? createPortal(
          <div className="toast-layer">
            {toasts.map((item) => (
              <div
                key={item.id}
                className={`toast toast-${item.tone}`}
                role={item.tone === "error" ? "alert" : "status"}
                aria-live={item.tone === "error" ? "assertive" : "polite"}
              >
                <span>{item.text}</span>
                <button type="button" onClick={() => dismiss(item.id)} aria-label={`Dismiss notification: ${item.text}`}>
                  ×
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {overlay}
    </ToastContext.Provider>
  );
}
