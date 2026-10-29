"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type TooltipState = {
  text: string;
  left: number;
  top: number;
  side: "top" | "bottom";
};

/** One tooltip layer for icon controls on every route, including dialogs and drawers. */
export function AppTooltips() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let hovered: HTMLElement | null = null;
    let dismissed: HTMLElement | null = null;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let touchTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (showTimer) clearTimeout(showTimer);
      if (touchTimer) clearTimeout(touchTimer);
      showTimer = null;
      touchTimer = null;
    };

    const hide = () => {
      clearTimers();
      hovered = null;
      setTooltip(null);
    };

    const findTarget = (event: Event) =>
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-tooltip], button[aria-label], a[aria-label]")
        : null;

    const show = (element: HTMLElement) => {
      const text = element.dataset.tooltip?.trim() || element.getAttribute("aria-label")?.trim();
      if (!text || !element.isConnected) return;
      const rect = element.getBoundingClientRect();
      const side = rect.top >= 76 ? "top" : "bottom";
      const edge = Math.min(142, window.innerWidth / 2);
      setTooltip({
        text,
        left: Math.max(edge, Math.min(window.innerWidth - edge, rect.left + rect.width / 2)),
        top: side === "top" ? rect.top - 10 : rect.bottom + 10,
        side,
      });
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = findTarget(event);
      if (!target || target === hovered || target === dismissed) return;
      clearTimers();
      setTooltip(null);
      hovered = target;
      showTimer = setTimeout(() => show(target), 350);
    };

    const onPointerOut = (event: PointerEvent) => {
      if (dismissed && !dismissed.contains(event.relatedTarget as Node | null)) dismissed = null;
      if (hovered && !hovered.contains(event.relatedTarget as Node | null)) hide();
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = findTarget(event);
      if (!target || target === dismissed) return;
      clearTimers();
      hovered = target;
      show(target);
    };

    const onFocusOut = (event: FocusEvent) => {
      if (hovered && !hovered.contains(event.relatedTarget as Node | null)) hide();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = findTarget(event);
      if (!target) return;
      if (event.pointerType !== "touch") {
        dismissed = target;
        hide();
        return;
      }
      clearTimers();
      hovered = target;
      touchTimer = setTimeout(() => show(target), 500);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") hide();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    const onClick = (event: MouseEvent) => {
      dismissed = findTarget(event);
      hide();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      clearTimers();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!tooltip) return null;
  return createPortal(
    <div
      className="app-icon-tooltip"
      data-side={tooltip.side}
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.text}
    </div>,
    document.body,
  );
}
