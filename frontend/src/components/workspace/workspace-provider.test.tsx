import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/courses",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => ({ isSigningOut: false, error: "", signOut: vi.fn() }) }));
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(async () => ({ role: "admin", display_name: "Admin Verify", pseudonym_id: "admin_verify" })),
  getErrorMessage: (error: unknown) => String(error),
}));
vi.mock("@/lib/workspace", () => ({ getAdminCourses: vi.fn(async () => ({ courses: [] })) }));

import { WorkspaceProvider } from "./workspace-provider";

afterEach(cleanup);

it("opens and closes the small-screen navigation with an accurate expanded state", async () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
  render(<WorkspaceProvider role="admin"><p>Course screen</p></WorkspaceProvider>);
  const toggle = await screen.findByRole("button", { name: "Toggle workspace menu" });
  await waitFor(() => expect(toggle.getAttribute("aria-expanded")).toBe("false"));
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByLabelText("Administrator navigation").className).toContain("is-open");
  const courseLink = screen.getByRole("link", { name: "Courses" });
  courseLink.addEventListener("click", (event) => event.preventDefault(), { once: true });
  fireEvent.click(courseLink);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});
