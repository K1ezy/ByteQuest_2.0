import Link from "next/link";
import { Fragment } from "react";
import { instructorNavigation, isCurrentInstructorPage } from "@/lib/navigation";
import { InstructorIcon } from "./course-ui";

export function CourseNavigationLinks({ pathname, courseHref, onNavigate, hiddenLinks = [] }: {
  pathname: string; courseHref: (href: string) => string; onNavigate?: () => void; hiddenLinks?: readonly string[];
}) {
  return instructorNavigation.map(({ title, links }) => {
    const shown = links.filter(([, href]) => !hiddenLinks.includes(href));
    return shown.length ? <Fragment key={title}>
    <p className="ic-nav-group">{title}</p>
    {shown.map(([label, href, icon]) => <Link key={label} href={href === "/workshops" ? href : courseHref(href)} onClick={onNavigate}
      aria-current={isCurrentInstructorPage(pathname, href) ? "page" : undefined}>
      <InstructorIcon name={icon} />{label}
    </Link>)}
  </Fragment> : null;
  });
}
