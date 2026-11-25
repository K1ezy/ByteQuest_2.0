import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminSectionNav } from "./section-nav";

const path = vi.hoisted(() => ({ current: "/admin" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));
afterEach(cleanup);

it("leaves Accounts as a standalone page without course management tabs", () => {
  path.current = "/admin/accounts";
  render(<AdminSectionNav />);
  expect(screen.queryByRole("navigation")).toBeNull();
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
