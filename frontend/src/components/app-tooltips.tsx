"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

type TooltipState = {
  text: string;
  left: number;
  top: number;
  side: "top" | "bottom";
  container: HTMLElement;
};

const TRIGGER = "[data-tooltip], button[aria-label], a[aria-label]";
const contains = (element: HTMLElement | null, target: EventTarget | null) =>
  target instanceof Node && Boolean(element?.contains(target));

export function AppTooltips() {
  const id = useId();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let active: HTMLElement | null = null;
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    let longPressed: HTMLElement | null = null;
    let touch: { target: HTMLElement; x: number; y: number } | null = null;
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    function findTarget(target: EventTarget | null) {
      return target instanceof Element ? target.closest<HTMLElement>(TRIGGER) : null;
    }

    function clearTimers() {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    }

    function unlink() {
      if (!active) return;
      const ids = (active.getAttribute("aria-describedby") || "").split(/\s+/).filter((value) => value && value !== id);
      if (ids.length) active.setAttribute("aria-describedby", ids.join(" "));
      else active.removeAttribute("aria-describedby");
      active = null;
    }

    function hide() {
      clearTimers();
      unlink();
      setTooltip(null);
    }

    function show(target: HTMLElement) {
      const text = target.dataset.tooltip?.trim() || target.getAttribute("aria-label")?.trim();
      if (!text || !target.isConnected) return;
      if (active !== target) {
        unlink();
        const describedBy = target.getAttribute("aria-describedby")?.trim();
        target.setAttribute("aria-describedby", describedBy ? `${describedBy} ${id}` : id);
        active = target;
      }
      const rect = target.getBoundingClientRect();
      const side = rect.top >= 88 && rect.top > window.innerHeight - rect.bottom ? "top" : "bottom";
      const edge = Math.min(142, window.innerWidth / 2);
      setTooltip({
        text,
        left: Math.max(edge, Math.min(window.innerWidth - edge, rect.left + rect.width / 2)),
        top: side === "top" ? rect.top - 6 : rect.bottom + 6,
        side,
        container: target.closest<HTMLElement>("dialog[open]") ?? document.body,
      });
    }

    function onPointerOver(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      if (contains(document.getElementById(id), event.target)) {
        window.clearTimeout(hideTimer);
        return;
      }
      const target = findTarget(event.target);
      if (!target || hovered === target) return;
      hovered = target;
      if (active === target) {
        window.clearTimeout(hideTimer);
        return;
      }
      hide();
      showTimer = window.setTimeout(() => show(target), 350);
    }

    function onPointerOut(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const panel = document.getElementById(id);
      if (contains(hovered, event.relatedTarget) || contains(panel, event.relatedTarget)) return;
      if (!contains(hovered, event.target) && !contains(panel, event.target)) return;
      hovered = null;
      window.clearTimeout(showTimer);
      if (active && active !== focused) hideTimer = window.setTimeout(hide, 180);
    }

    function onFocusIn(event: FocusEvent) {
      const target = findTarget(event.target);
      focused = target?.matches(":focus-visible") ? target : null;
      if (!focused) return;
      hide();
      show(focused);
    }

    function onFocusOut(event: FocusEvent) {
      if (contains(focused, event.relatedTarget)) return;
      if (active === focused && active !== hovered && !document.getElementById(id)?.matches(":hover")) hide();
      focused = null;
    }

    function onPointerDown(event: PointerEvent) {
      hide();
      longPressed = null;
      touch = null;
      const target = findTarget(event.target);
      if (event.pointerType !== "touch" || !target) return;
      touch = { target, x: event.clientX, y: event.clientY };
      showTimer = window.setTimeout(() => {
        longPressed = target;
        show(target);
      }, 550);
    }

    function onPointerMove(event: PointerEvent) {
      if (!touch || event.pointerType !== "touch") return;
      if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) onPointerEnd();
    }

    function onPointerEnd() {
      if (touch) window.clearTimeout(showTimer);
      touch = null;
    }

    function onClick(event: MouseEvent) {
      if (longPressed && event.detail > 0 && contains(longPressed, event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        longPressed = null;
        return;
      }
      hide();
    }

    function onContextMenu(event: MouseEvent) {
      if ((touch && contains(touch.target, event.target)) || contains(longPressed, event.target)) {
        event.preventDefault();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && active && active.isConnected && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        hide();
      }
    }

    const listeners = new AbortController();
    const signal = listeners.signal;
    document.addEventListener("pointerover", onPointerOver, { signal });
    document.addEventListener("pointerout", onPointerOut, { signal });
    document.addEventListener("pointerdown", onPointerDown, { signal });
    document.addEventListener("pointermove", onPointerMove, { signal });
    document.addEventListener("pointerup", onPointerEnd, { signal });
    document.addEventListener("pointercancel", onPointerEnd, { signal });
    document.addEventListener("click", onClick, { capture: true, signal });
    document.addEventListener("contextmenu", onContextMenu, { signal });
    document.addEventListener("focusin", onFocusIn, { signal });
    document.addEventListener("focusout", onFocusOut, { signal });
    window.addEventListener("keydown", onKeyDown, { capture: true, signal });
    document.addEventListener("scroll", hide, { capture: true, signal });
    window.addEventListener("resize", hide, { signal });
    return () => {
      listeners.abort();
      clearTimers();
      unlink();
    };
  }, [id]);

  if (!tooltip) return null;
  return createPortal(
    <div
      id={id}
      className="app-icon-tooltip"
      data-side={tooltip.side}
      role="tooltip"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      {tooltip.text}
    </div>,
    tooltip.container,
  );
}
