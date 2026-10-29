import type { ReactNode } from "react";

export type QuestNavIconName =
  | "home"
  | "code"
  | "review"
  | "leaderboard"
  | "accessibility"
  | "person"
  | "faculty"
  | "grid"
  | "chat"
  | "materials"
  | "performance"
  | "assignments"
  | "configuration"
  | "monitoring"
  | "courses"
  | "reviewQueue";

export function QuestNavIcon({ name }: { name: QuestNavIconName }) {
  const textIcons: Partial<Record<QuestNavIconName, string>> = {
    home: "⌂",
    code: "</>",
    review: "✓",
    leaderboard: "▤",
  };
  const textIcon = textIcons[name];
  if (textIcon) return <span className="qm-nav-icon" aria-hidden="true">{textIcon}</span>;

  const shared: Partial<Record<QuestNavIconName, ReactNode>> = {
    accessibility: <><circle cx="12" cy="4" r="2" /><path d="m19 13-4-2-3 1-3-1-4 2M12 9v5l-2 7m2-7 2 7" /></>,
    person: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.4-3.4 2.9-5.5 6.5-5.5s6.1 2.1 6.5 5.5" /></>,
    faculty: <><path d="m3 9 9-4 9 4-9 4-9-4ZM7 11.5V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5M21 9v5" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><rect x="14" y="14" width="6" height="6" rx="1.2" /></>,
    chat: <><path d="M21 11.5a8 8 0 0 1-8 8H7l-4 3v-5.6A8 8 0 0 1 11 5h2a8 8 0 0 1 8 6.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
    materials: <><path d="M6 3h9l3 3v15H6zM15 3v4h3M9 11h6M9 15h6M9 19h4" /></>,
    performance: <><path d="M4 19h16M6 16l4-5 3 2 5-7" /><path d="M15 6h3v3" /></>,
    assignments: <><path d="M5 7h14m-3-3 3 3-3 3M19 17H5m3-3-3 3 3 3" /></>,
    configuration: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    monitoring: <><rect x="3" y="4" width="18" height="15" rx="2" /><path d="M6 12h3l2-4 2 7 2-3h3M9 22h6" /></>,
    courses: <><path d="m3 9 9-4 9 4-9 4-9-4ZM7 11.5V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5M21 9v5" /></>,
    reviewQueue: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h5m-5 5 2 2 5-5" /></>,
  };

  return <span className="qm-nav-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {shared[name]}
    </svg>
  </span>;
}

