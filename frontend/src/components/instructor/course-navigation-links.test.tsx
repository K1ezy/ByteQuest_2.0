import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CourseNavigationLinks } from "./course-navigation-links";

afterEach(cleanup);
const href = (path: string) => path;

it("hides Model evaluation when there is nothing to show, keeping the rest of Insights", () => {
  render(<CourseNavigationLinks pathname="/instructor" courseHref={href} hiddenLinks={["/instructor/ml"]} />);
  expect(screen.queryByRole("link", { name: "Model evaluation" })).toBeNull();
  expect(screen.getByRole("link", { name: "Gamification" })).toBeTruthy();
  expect(screen.getByText("Insights")).toBeTruthy();
});

it("shows Model evaluation by default", () => {
  render(<CourseNavigationLinks pathname="/instructor" courseHref={href} />);
  expect(screen.getByRole("link", { name: "Model evaluation" })).toBeTruthy();
});
