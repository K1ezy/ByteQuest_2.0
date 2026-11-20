"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { ChatShell } from "@/components/chat/chat-shell";
import { AppNavIcon } from "@/components/workspace/app-nav-icon";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { belongsTo, primaryNavigation } from "@/lib/navigation";
import { InstructorIcon, type InstructorIconName } from "./course-ui";

const groups = [
  { title: "Teach", links: [
    ["Dashboard", "/instructor", "home"], ["Activities", "/instructor/activities", "code"],
    ["Review drafts", "/instructor/review", "check"], ["Materials", "/instructor/materials", "file"],
    ["Exams", "/instructor/exams", "clipboard"], ["Announcements", "/instructor/announcements", "bell"],
  ] },
  { title: "Students", links: [
    ["Progress", "/instructor/performance", "users"],
    ["Gradebook", "/instructor/performance#instructor-gradebook", "table"],
  ] },
  { title: "Insights", links: [
    ["Gamification", "/instructor/gamification", "trophy"], ["Machine learning", "/instructor/ml", "chart"],
  ] },
] as const satisfies readonly { title: string; links: readonly (readonly [string, string, InstructorIconName])[] }[];

// An in-page anchor never marks the page; the dashboard matches only itself, other sections their sub-pages too.
const isCurrent = (pathname: string, href: string) =>
  !href.includes("#") && (pathname === href || (href !== "/instructor" && belongsTo(pathname, href)));

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

export function InstructorCourseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { courseHref, courseId, courses, setCourse, profile } = useWorkspace();
  return <div className="ic-shell">
    <header className="ic-topbar bq-app-topbar">
      <Link className="ic-brand" href={courseHref("/instructor")}>ByteQuest</Link>
      <CourseSwitcher courses={courses} selected={courseId} onSelect={setCourse} />
      <span className="ic-spacer" />
      <ChatShell />
      <Link className="ic-button ic-icon-button" href={courseHref("/instructor#instructor-recent")}
        aria-label="Notifications" data-tooltip="Recent course activity"><InstructorIcon name="bell" /></Link>
      <AccountMenu key={pathname} profile={profile} />
    </header>
    <div className="ic-grid">
      <nav className="ic-sidebar" aria-label="Instructor">
        {groups.map(({ title, links }) => <Fragment key={title}>
          <p className="ic-nav-group">{title}</p>
          {links.map(([label, href, icon]) => <Link key={label} href={courseHref(href)} aria-current={isCurrent(pathname, href) ? "page" : undefined}>
            <InstructorIcon name={icon} />{label}
          </Link>)}
        </Fragment>)}
      </nav>
      <main id="main-content" className="ic-body" tabIndex={-1}>{children}</main>
    </div>
    <nav className="ic-mobile-nav" id="app-navigation" aria-label="Instructor navigation">
      {primaryNavigation.instructor.map(([href, , label]) => <Link key={href} href={courseHref(href)} aria-current={pathname === href ? "page" : undefined}>
        <AppNavIcon href={href} />{label}
      </Link>)}
    </nav>
  </div>;
}
