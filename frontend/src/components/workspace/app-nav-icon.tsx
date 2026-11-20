import type { ReactNode } from "react";

/* Line icons for the primary destinations. One shape per page, shared by the desktop
   sidebar and the phone tab bar, so a page looks the same at every screen size. */
const icons: Record<string, ReactNode> = {
  "/dashboard": <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  "/quests": <><path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  "/exams": <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2.5" width="6" height="3" rx="1" /><path d="m9 13 2 2 4-4" /></>,
  "/workshops": <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 15.2c1.8.6 2.8 2.2 3 4.8" /></>,
  "/leaderboard": <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" /></>,
  "/instructor": <><path d="m3 9 9-4 9 4-9 4-9-4Z" /><path d="M7 11.5V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5M21 9v5" /></>,
  "/instructor/activities": <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
  "/instructor/performance": <><path d="M4 19h16" /><path d="m6 16 4-5 3 2 5-7" /><path d="M15 6h3v3" /></>,
  "/instructor/gamification": <><path d="m12 3 1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
  "/instructor/exams": <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2.5" width="6" height="3" rx="1" /><path d="m9 13 2 2 4-4" /></>,
  "/admin": <><rect x="4" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" /></>,
  "/admin/courses": <><path d="m3 9 9-4 9 4-9 4-9-4Z" /><path d="M7 11.5V16c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5M21 9v5" /></>,
  "/admin/accounts": <><circle cx="10" cy="8" r="3.2" /><path d="M4 20c.4-3.4 2.9-5.5 6-5.5 1.2 0 2.3.3 3.2.8" /><circle cx="18" cy="17" r="2.2" /><path d="M18 13.5v1.3M18 19.2v1.3M14.5 17h1.3M20.2 17h1.3" /></>,
  "/admin/activities": <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  "/admin/teaching": <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M12 16v4M8 20h8" /></>,
};

export function AppNavIcon({ href }: { href: string }) {
  return <span className="bq-nav-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[href] ?? <circle cx="12" cy="12" r="4" />}
    </svg>
  </span>;
}
