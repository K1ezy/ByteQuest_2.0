import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminSectionNav } from "./section-nav";

const path = vi.hoisted(() => ({ current: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));
afterEach(cleanup);

it("shows the tab row of the group the current page belongs to, with Accounts beside Course access", () => {
  path.current = "/admin/accounts";
  render(<AdminSectionNav />);
  const nav = screen.getByRole("navigation", { name: "Course and account sections" });
  expect([...nav.querySelectorAll("a")].map(link => link.textContent)).toEqual(["Courses", "Course access", "Accounts"]);
  expect(screen.getByRole("link", { name: "Accounts" }).getAttribute("aria-current")).toBe("page");
});

it("groups Activities with Materials and the system pages together", () => {
  path.current = "/admin/materials";
  const view = render(<AdminSectionNav />);
  expect(screen.getByRole("navigation", { name: "Content sections" })).toBeTruthy();
  path.current = "/admin/configuration";
  view.rerender(<AdminSectionNav />);
  expect(screen.getByRole("link", { name: "Monitoring" })).toBeTruthy();
});

it("shows no tab row outside the admin groups", () => {
  path.current = "/admin/teaching";
  const { container } = render(<AdminSectionNav />);
  expect(container.innerHTML).toBe("");
});
