"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { weeklyChange } from "@/lib/instructor-dashboard";

const icons = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-7h4v7h5V9.5" /></>,
  code: <path d="m7 6-6 6 6 6m10-12 6 6-6 6M14 4l-4 16" />,
  file: <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Zm0 0v5h5M8 12h8m-8 4h8" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2.5" width="6" height="3" rx="1" /><path d="m9 13 2 2 4-4" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5M16 5.2a3 3 0 0 1 0 5.6M17.5 15.2c1.8.6 2.8 2.2 3 4.8" /></>,
  inbox: <path d="M3 13 6 5h12l3 8v6H3zm0 0h5l2 3h4l2-3h5" />,
  table: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M9 10v9" /></>,
  chart: <path d="M4 19V5m0 14h17M9 16v-3m5 3V9m5 7V6" />,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" /></>,
  bell: <path d="M9 19a3 3 0 0 0 6 0M5 16h14l-2-3V8a5 5 0 0 0-10 0v5Z" />,
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upArrow: <path d="M12 19V5m-5 5 5-5 5 5" />,
  downArrow: <path d="M12 5v14m-5-5 5 5 5-5" />,
  warning: <path d="M12 4 2.7 20h18.6ZM12 9v4m0 3h.01" />,
  pause: <><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 3 1m4 1v5m4-5v5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2" /></>,
};

export type InstructorIconName = keyof typeof icons;

export function InstructorIcon({ name }: { name: InstructorIconName }) {
  return <svg className="ic-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return <div className="ic-page-head"><div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
    {actions ? <div className="ic-page-actions">{actions}</div> : null}
  </div>;
}

export interface StatItem {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  change?: { current: number; previous: number | null };
}

export function StatStrip({ items }: { items: StatItem[] }) {
  return <dl className="ic-stats" aria-label="Course statistics">
    {items.map(({ label, value, note, change }) => {
      const comparison = change && weeklyChange(change.current, change.previous);
      return <div className="ic-stat" key={label}>
        <dt>{label}</dt><dd className="ic-stat-value">{value}</dd>
        <dd className={`ic-stat-note${comparison?.tone ? ` ${comparison.tone}` : ""}`}>
          {comparison?.tone ? <InstructorIcon name={comparison.tone === "up" ? "upArrow" : "downArrow"} /> : null}
          {comparison?.note ?? note}
        </dd>
      </div>;
    })}
  </dl>;
}

export function Section({ title, children, action, id, className = "" }: {
  title: string; children: ReactNode; action?: ReactNode; id?: string; className?: string;
}) {
  const titleId = useId();
  return <section id={id} className={`ic-section ${className}`} aria-labelledby={titleId}>
    <div className="ic-section-head"><h2 id={titleId}>{title}</h2>{action}</div>{children}
  </section>;
}

export function StatusBadge({ children, tone = "dot" }: { children: ReactNode; tone?: "dot" | "danger" | "warning" }) {
  return <span className={`ic-status-badge ${tone}`}>{children}</span>;
}

export function DataRow({ title, href, description, status, lead, action, menu, indicators, chevron = false }: {
  title: string; href: string; description?: ReactNode; status?: ReactNode; lead?: ReactNode;
  action?: ReactNode; menu?: ReactNode; indicators?: ReactNode; chevron?: boolean;
}) {
  return <li className="ic-row">
    {status ? <div className="ic-status">{status}</div> : lead ? <span className="ic-row-lead" aria-hidden="true">{lead}</span> : null}
    <div className="ic-row-main">
      <Link className="ic-row-title" href={href}>{title}{indicators ? <span className="ic-indicators">{indicators}</span> : null}</Link>
      {description ? <div className="ic-row-description">{description}</div> : null}
    </div>
    {action || menu ? <div className="ic-row-actions">{action}{menu}</div> : null}
    {chevron ? <span className="ic-row-chevron" aria-hidden="true"><InstructorIcon name="right" /></span> : null}
  </li>;
}

export function InlineEmpty({ children }: { children: ReactNode }) {
  return <p className="ic-empty">{children}</p>;
}

export function InlineError({ onRetry }: { onRetry: () => void }) {
  return <div className="ic-inline-error" role="alert"><span>Couldn&apos;t load this section.</span>
    <button type="button" className="ic-button" onClick={onRetry}>Try again</button>
  </div>;
}

export function StatSkeleton() {
  return <div className="ic-stats" role="status" aria-label="Loading course statistics">
    {[0, 1, 2, 3].map((key) => <div className="ic-stat" key={key} aria-hidden="true">
      <span className="ws-skeleton ic-skeleton-line" /><span className="ws-skeleton ic-skeleton-value" /><span className="ws-skeleton ic-skeleton-line" />
    </div>)}
  </div>;
}

export function RowSkeleton({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label="Loading this section" className={compact ? "ic-skeleton-feed" : undefined}>
    {[0, 1, 2].map((key) => <div key={key} className="ic-skeleton-row" aria-hidden="true"><span className="ws-skeleton ic-skeleton-line" /></div>)}
  </div>;
}
