"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";

type Side = "left" | "right";

// One side preference per account on this device, shared by the Menu and Accessibility settings.
const storageKey = (ownerId: string) => "bytequest:menu-side:" + ownerId;
const unsavedSides = new Map<string, Side>();  // only used while browser storage is blocked
const sideListeners = new Set<() => void>();

function readMenuSide(ownerId: string): Side {
  try { return localStorage.getItem(storageKey(ownerId)) === "right" ? "right" : "left"; }
  catch { return unsavedSides.get(ownerId) ?? "left"; }
}

function setMenuSide(ownerId: string, side: Side) {
  try { localStorage.setItem(storageKey(ownerId), side); }
  catch { unsavedSides.set(ownerId, side); }
  sideListeners.forEach(listener => listener());
}

function useMenuSide(ownerId: string): Side {
  return useSyncExternalStore(listener => {
    sideListeners.add(listener);
    return () => { sideListeners.delete(listener); };
  }, () => readMenuSide(ownerId), () => "left");
}

export function MenuPositionSetting({ ownerId }: { ownerId: string }) {
  const side = useMenuSide(ownerId);
  return <fieldset className="bq-dock-side">
    <legend>Menu position</legend>
    <p>To change sides of the navigation bar, hold it, drag it across the screen, and release.
      You can also choose Move left or Move right here with touch or keyboard.
      ByteQuest remembers the choice per user on that device.</p>
    {(["left", "right"] as const).map(value => <button key={value} type="button" className="button button-outline"
      aria-pressed={side === value} onClick={() => setMenuSide(ownerId, value)}>Move {value}</button>)}
  </fieldset>;
}

/**
 * The workspace navigation: a sidebar on wide screens and a rail on handhelds, on the saved
 * side. Hold it for 450 ms, drag it across the screen and release to dock it on that side. A short tap still
 * follows the link under the finger; Accessibility settings offer the same choice by keyboard.
 */
export function DockableNavigation({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const side = useMenuSide(ownerId);
  const [offset, setOffset] = useState<number | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const press = useRef<{ id: number; x: number; y: number; left: number; width: number;
    timer: ReturnType<typeof setTimeout>; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 850px)");
    const reset = () => {
      if (press.current) clearTimeout(press.current.timer);
      press.current = null;
      setOffset(null);
    };
    query?.addEventListener("change", reset);
    return () => {
      query?.removeEventListener("change", reset);
      if (press.current) clearTimeout(press.current.timer);
    };
  }, []);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || press.current) return;
    suppressClick.current = false;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const id = event.pointerId;
    press.current = { id, x: event.clientX, y: event.clientY, left, width, dragging: false,
      timer: setTimeout(() => {
        if (!press.current) return;
        press.current.dragging = true;
        suppressClick.current = true;
        // Capture only once the hold succeeds, so ordinary taps reach the link under the finger.
        try { rail.current?.setPointerCapture(id); } catch { /* the pointer already ended */ }
        setOffset(0);
      }, 450) };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p || p.id !== event.pointerId) return;
    const dx = event.clientX - p.x;
    if (p.dragging) {
      setOffset(Math.min(window.innerWidth - p.left - p.width, Math.max(-p.left, dx)));
    } else if (Math.hypot(dx, event.clientY - p.y) > 8) {
      clearTimeout(p.timer);
      press.current = null;
    }
  }

  function finish(event: PointerEvent<HTMLDivElement>, commit: boolean) {
    const p = press.current;
    if (!p || p.id !== event.pointerId) return;
    clearTimeout(p.timer);
    if (commit && p.dragging) setMenuSide(ownerId, event.clientX < window.innerWidth / 2 ? "left" : "right");
    press.current = null;
    setOffset(null);
  }

  return <div ref={rail} className="bq-dock" data-side={side}
    style={offset === null ? undefined : { transform: `translateX(${offset}px)`, cursor: "grabbing" }}
    onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(event, true)}
    onPointerCancel={event => finish(event, false)}
    onLostPointerCapture={event => { if (event.target === event.currentTarget) finish(event, false); }}
    onContextMenu={event => { if (press.current) event.preventDefault(); }}
    onClickCapture={event => {
      // The release that ends a drag must not also open the link it started on.
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }}>
    {children}
  </div>;
}
