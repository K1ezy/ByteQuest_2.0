"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [["/admin", "Overview"], ["/admin/monitoring", "Monitoring"], ["/admin/configuration", "Configuration"]] as const;

/** One labeled switcher for the System pages, shown only on those pages. */
export function AdminSectionNav() {
  const pathname = usePathname();
  if (!SECTIONS.some(([href]) => href === pathname)) return null;
  return (
    <nav className="ws-section-nav" aria-label="System sections">
      {SECTIONS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
