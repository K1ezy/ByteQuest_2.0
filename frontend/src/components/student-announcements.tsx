"use client";

import { useId, useRef, useState } from "react";
import { Button, StatusChip } from "@/components/workspace/ui";
import { formatDateTime, type StudentAnnouncement } from "@/lib/workspace";

const DISMISS_PREFIX = "bytequest:announcement-dismissed:";

function readDismissed() {
  try {
    return new Set(Object.keys(window.localStorage)
      .filter((key) => key.startsWith(DISMISS_PREFIX))
      .map((key) => key.slice(DISMISS_PREFIX.length)));
  } catch {
    return new Set<string>();
  }
}

export function StudentAnnouncements({ items, now, onEmpty }: {
  items: StudentAnnouncement[];
  now: Date;
  onEmpty?: () => void;
}) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const listId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const visible = items.filter((item) => !dismissed.has(item.id) && (!item.expires_at || Date.parse(item.expires_at) > now.getTime()));

  if (!visible.length) return null;

  function dismiss(id: string) {
    try { window.localStorage.setItem(DISMISS_PREFIX + id, "1"); } catch { /* This visit can still dismiss it. */ }
    setDismissed((current) => new Set(current).add(id));
    if (visible.length > 1) heading.current?.focus();
    else onEmpty?.();
  }

  return (
    <section className="pilot-card student-announcements" aria-labelledby={headingId}>
      <h2 id={headingId} tabIndex={-1} ref={heading}>Announcements</h2>
      <ul className="announcement-list" id={listId}>
        {(expanded ? visible : visible.slice(0, 1)).map((item) => (
          <li key={item.id}>
            <div className="announcement-student-header">
              <div>
                <div className="ws-row-heading">
                  <h3 className="announcement-copy">{item.title}</h3>
                  {item.pinned ? <StatusChip state="active" label="Pinned" /> : null}
                </div>
                <p className="ws-row-meta">{item.course_title} · {item.author_name} · {formatDateTime(item.created_at)}</p>
              </div>
              <Button className="ws-touch-action" variant="quiet" onClick={() => dismiss(item.id)} aria-label={`Dismiss ${item.title}`}>Dismiss</Button>
            </div>
            <p className="announcement-copy">{item.body}</p>
          </li>
        ))}
      </ul>
      {visible.length > 1 ? (
        <Button className="ws-touch-action" variant="quiet" aria-controls={listId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer announcements" : `Show all ${visible.length} announcements`}
        </Button>
      ) : null}
    </section>
  );
}
