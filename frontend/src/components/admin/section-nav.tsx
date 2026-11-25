"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Admin pages grouped by task. */
export const ADMIN_SECTION_GROUPS = [
  { label: "Content sections", links: [["/admin/activities", "Activities"], ["/admin/materials", "Materials"]] },
  { label: "System sections", links: [["/admin", "Overview"], ["/admin/monitoring", "Monitoring"], ["/admin/configuration", "Configuration"]] },
] as const;

/** One labeled tab row for the group the current page belongs to. */
export function AdminSectionNav() {
  const pathname = usePathname();
  const group = ADMIN_SECTION_GROUPS.find(({ links }) => links.some(([href]) => href === pathname));
  if (!group) return null;
  return (
    <nav className="ws-section-nav" aria-label={group.label}>
      {group.links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
