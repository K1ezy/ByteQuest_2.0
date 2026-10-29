"use client";

import { useEffect, RefObject } from "react";

interface SafeNavigationOptions {
  containerRef: RefObject<HTMLElement | null>;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onNextItem?: () => void;
  onPrevItem?: () => void;
  isEnabled?: boolean;
}

/**
 * Defensive keyboard & wheel controller hook.
 * Guardrails:
 * 1. Never hijacks keys if the user is typing in an input, textarea, select, or code editor.
 * 2. Only intercepts the mouse scroll wheel when the window itself is explicitly focused (clicked),
 *    preventing accidental interception when the user is casually scrolling down the page.
 */
export function useSafeWindowNavigation({
  containerRef,
  onNextSlide,
  onPrevSlide,
  onNextItem,
  onPrevItem,
  isEnabled = true,
}: SafeNavigationOptions) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isEnabled) return;

    // Guard: Never hijack keys if user is typing in a form or code editor
    const isTypingInFormElement = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable ||
        target.closest(".monaco-editor, .cm-editor, [role='textbox']") !== null
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only run if this specific window (or an element inside it) has focus
      if (!container.contains(document.activeElement)) return;
      if (isTypingInFormElement(e.target)) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          onNextSlide();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onPrevSlide();
          break;
        case "ArrowDown":
          if (onNextItem) {
            e.preventDefault();
            onNextItem();
          }
          break;
        case "ArrowUp":
          if (onPrevItem) {
            e.preventDefault();
            onPrevItem();
          }
          break;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // ONLY intercept scroll wheel when the window itself is explicitly focused (clicked)
      // This prevents freezing normal page scrolling when the user just scrolls past the card
      if (document.activeElement !== container) return;
      if (isTypingInFormElement(e.target)) return;

      e.preventDefault();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (e.deltaX > 20) onNextSlide();
        else if (e.deltaX < -20) onPrevSlide();
      } else {
        if (e.deltaY > 20 && onNextItem) onNextItem();
        else if (e.deltaY < -20 && onPrevItem) onPrevItem();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    // { passive: false } is required so e.preventDefault() works cleanly without console warnings
    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("wheel", handleWheel);
    };
  }, [containerRef, onNextSlide, onPrevSlide, onNextItem, onPrevItem, isEnabled]);
}
