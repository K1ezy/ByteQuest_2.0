"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { ChatShell } from "@/components/chat/chat-shell";
import { AppNavIcon } from "@/components/workspace/app-nav-icon";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { isCurrentInstructorPage, primaryNavigation } from "@/lib/navigation";
import type { Profile } from "@/lib/types";
import { InstructorIcon } from "./course-ui";
import { CourseNavigationLinks } from "./course-navigation-links";
import { DockableNavigation } from "@/components/workspace/dockable-navigation";

export function CourseSwitcher({ courses, selected, onSelect }: {
  courses: { id: string; title: string }[]; selected: string | null; onSelect: (id: string) => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (details.current && !details.current.contains(event.target as Node)) details.current.open = false;
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  if (!courses.length) return null;
  return <details className="ic-switcher" ref={details} onKeyDown={(event) => {
    if (event.key !== "Escape" || !event.currentTarget.open) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.open = false;
    trigger.current?.focus();
  }}>
    <summary className="ic-button" aria-label="Choose course" ref={trigger}>
      <span>{courses.find((course) => course.id === selected)?.title ?? "Choose a course"}</span><InstructorIcon name="down" />
    </summary>
    <div className="ic-switch-options">
      {courses.map((course) => <button key={course.id} type="button" className="ic-button"
        aria-current={selected === course.id ? "true" : undefined} onClick={() => {
          if (details.current) details.current.open = false;
          trigger.current?.focus();
          if (selected !== course.id) onSelect(course.id);
        }}>{course.title}</button>)}
    </div>
  </details>;
}

/** Phone-only: the full instructor menu in a bottom sheet, so no page is unreachable on a phone. */
function MoreNavigation({ pathname, courseHref, hiddenLinks }: {
  pathname: string; courseHref: (href: string) => string; hiddenLinks?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const primary = primaryNavigation.instructor.map(([href]) => href);
  const elsewhere = !primary.some((href) => isCurrentInstructorPage(pathname, href));
  useEffect(() => {
    const dialog = sheet.current;
    if (!open || !dialog) return;
    dialog.showModal();
    const button = trigger.current;
    return () => { dialog.close(); button?.focus(); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" className="ic-more-trigger" aria-haspopup="dialog" aria-expanded={open}
      aria-current={elsewhere ? "page" : undefined} onClick={() => setOpen(true)}>
      <span className="bq-nav-icon" aria-hidden="true"><InstructorIcon name="menu" /></span>More
    </button>
    {open ? <dialog ref={sheet} className="bq-account-sheet ic-more-sheet" aria-label="Instructor menu"
      onCancel={(event) => { event.preventDefault(); setOpen(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <span className="bq-sheet-handle" aria-hidden="true" />
      <nav className="ic-sidebar" aria-label="All instructor pages">
        <CourseNavigationLinks pathname={pathname} courseHref={courseHref} hiddenLinks={hiddenLinks} onNavigate={() => setOpen(false)} />
      </nav>
      <button type="button" className="ic-button" onClick={() => setOpen(false)}>Close</button>
    </dialog> : null}
  </>;
}

const workspaceHref = (href: string) => href;

export function InstructorShell({ children, profile, scope, courseHref = workspaceHref, hiddenLinks }: {
  children: ReactNode;
  profile: Profile;
  scope: ReactNode;
  courseHref?: (href: string) => string;
  hiddenLinks?: readonly string[];
}) {
  const pathname = usePathname();
  const links = <CourseNavigationLinks pathname={pathname} courseHref={courseHref} hiddenLinks={hiddenLinks} />;
  return <div className="ic-shell">
    <header className="ic-topbar bq-app-topbar">
      <Link className="ic-brand" href={courseHref("/instructor")}>ByteQuest</Link>
      {scope}
      <span className="ic-spacer" />
      <ChatShell />
      <Link className="ic-button ic-icon-button" href={courseHref("/instructor#instructor-recent")}
        aria-label="Recent course activity"><InstructorIcon name="bell" /></Link>
      <AccountMenu key={pathname} profile={profile} />
    </header>
    <div className="ic-grid">
      <DockableNavigation key={profile.id + pathname} ownerId={profile.id}>
        <nav className="ic-sidebar" aria-label="Instructor">{links}</nav>
        <nav className="ic-mobile-nav" id="app-navigation" aria-label="Instructor navigation">
          {primaryNavigation.instructor.map(([href, , label]) => <Link key={href} href={courseHref(href)}
            aria-current={isCurrentInstructorPage(pathname, href) ? "page" : undefined}>
            <AppNavIcon href={href} />{label}
          </Link>)}
          <MoreNavigation pathname={pathname} courseHref={courseHref} hiddenLinks={hiddenLinks} />
        </nav>
      </DockableNavigation>
      <main id="main-content" className="ic-body" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}

export function InstructorCourseShell({ children }: { children: ReactNode }) {
  const { courseHref, courseId, courses, setCourse, profile, modelEvaluationAvailable } = useWorkspace();
  // The page itself stays reachable from Student Progress and by its address (ML plan D9).
  const hiddenLinks = modelEvaluationAvailable === false ? ["/instructor/ml"] : undefined;
  return <InstructorShell profile={profile} courseHref={courseHref} hiddenLinks={hiddenLinks}
    scope={<CourseSwitcher courses={courses} selected={courseId} onSelect={setCourse} />}>
    {children}
  </InstructorShell>;
}
