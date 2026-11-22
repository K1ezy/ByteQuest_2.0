import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
  apiRequest: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
  courseId: "coursealpha",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/faculty/ml",
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({ courseId: mocks.courseId }),
  WorkspaceSuspense: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/workspace/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/workspace/ui")>();
  return { ...original, useApi: mocks.useApi };
});
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

import Page from "./page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("opens the single evaluation page for the default route and the evaluation bookmark", () => {
  mocks.useApi.mockReturnValue({data:null,error:"",loading:true,reload:vi.fn()});
  for (const search of ["","tab=evaluation"]) {
    mocks.params = new URLSearchParams(search);
    const view = render(<Page/>);
    expect(screen.getByRole("heading",{name:"Model evaluation"})).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(mocks.useApi).toHaveBeenCalledWith("/faculty/ml/evaluation?course_id=coursealpha");
    view.unmount();
  }
});
it("redirects old insights bookmarks with course and period intact", () => {
  mocks.params = new URLSearchParams("course=coursealpha&tab=insights&period=7d");
  render(<Page/>);
  expect(mocks.replace).toHaveBeenCalledWith("/instructor/performance?course=coursealpha&period=7d",{scroll:false});
});
