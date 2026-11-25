"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { useApi } from "@/components/workspace/ui";
import type { Workshop } from "@/lib/types";
import { classroomSummary } from "./workshop-classroom-details";
import { WorkshopBanner, WorkshopError, workshopLanguages } from "./workshop-ui";

const WorkshopContext = createContext<{ workshop: Workshop; setWorkshop: (item: Workshop) => void } | null>(null);

export function useWorkshop() {
  const value = useContext(WorkshopContext);
  if (!value) throw new Error("Workshop layout is required.");
  return value;
}

const pages = [
  { label: "Board", suffix: "" },
  { label: "Activities", suffix: "/activities" },
  { label: "Materials", suffix: "/materials" },
  { label: "People", suffix: "/people" },
  { label: "Progress", suffix: "/progress", management: true },
  { label: "Settings", suffix: "/settings", management: true },
];

export function WorkshopLayout({ id, children }: { id: string; children: ReactNode }) {
  const pathname = usePathname();
  const base = `/workshops/${encodeURIComponent(id)}`;
  const { data: workshop, error, loading, reload, setData } = useApi<Workshop>(base, true);
  const ownerOnly = pages.some(({ suffix, management }) => management && pathname === base + suffix);
  const onBoard = pathname === base;
  const classroom = workshop ? classroomSummary(workshop) : "";

  return <div className="workshop-page">
    <Link href="/workshops" className="workshop-text-link">← All workshops</Link>
    {loading ? <p className="workshop-panel" role="status">Loading workshop…</p>
      : error ? <WorkshopError message={error} retry={reload} />
      : workshop && <>
        {onBoard ? <WorkshopBanner language={workshop.language} coverImage={workshop.cover_image} eager>
          <span className="workshop-language">{workshopLanguages[workshop.language]}</span>
          <h1 tabIndex={-1} data-workshop-focus>{workshop.name}</h1>
          <p>{workshop.owner_name}</p>
          {classroom && <p className="workshop-classroom-summary">{classroom}</p>}
        </WorkshopBanner> : <header className="workshop-identity">
          <h1 tabIndex={-1} data-workshop-focus>{workshop.name}</h1>
          <p>{workshopLanguages[workshop.language]} · {workshop.owner_name}</p>
          {classroom && <p className="workshop-classroom-summary">{classroom}</p>}
        </header>}
        {workshop.archived && <p className="workshop-archive-notice" role="status">This workshop is archived. You can still access shared activities.</p>}
        <nav className="workshop-tabs" aria-label="Workshop pages">
          {pages.filter((page) => !page.management || workshop.is_owner).map(({ label, suffix }) => {
            const href = base + suffix;
            return <Link key={label} href={href} className={suffix === "/settings" ? "workshop-settings-tab" : undefined}
              aria-current={pathname === href ? "page" : undefined}>{label}</Link>;
          })}
        </nav>
        {ownerOnly && !workshop.is_owner
          ? <WorkshopError message="This workshop page is unavailable." />
          : <WorkshopContext.Provider value={{ workshop, setWorkshop: setData }}>{children}</WorkshopContext.Provider>}
      </>}
  </div>;
}
