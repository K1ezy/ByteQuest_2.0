import Link from "next/link";
import { Fragment } from "react";
import { instructorNavigation, isCurrentInstructorPage } from "@/lib/navigation";
import { InstructorIcon } from "./course-ui";

export function CourseNavigationLinks({ pathname, courseHref, onNavigate }: {
  pathname: string; courseHref: (href: string) => string; onNavigate?: () => void;
}) {
  return instructorNavigation.map(({ title, links }) => <Fragment key={title}>
    <p className="ic-nav-group">{title}</p>
    {links.map(([label, href, icon]) => <Link key={label} href={href === "/workshops" ? href : courseHref(href)} onClick={onNavigate}
      aria-current={isCurrentInstructorPage(pathname, href) ? "page" : undefined}>
      <InstructorIcon name={icon} />{label}
    </Link>)}
  </Fragment>);
}
