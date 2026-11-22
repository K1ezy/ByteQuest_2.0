import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CourseHealth, healthAction, type CourseHealthRow } from "./course-health";

const mock = vi.hoisted(() => vi.fn());
vi.mock("@/components/workspace/ui", async orig => ({...await orig<typeof import("@/components/workspace/ui")>(),useApi:mock}));
afterEach(cleanup);
const row:CourseHealthRow = { id:"c", code:"QA", title:"QA course", course_status:"active",status:"available",
  instructor_count:1,instructors:["Instructor"],enrolled:8,published_activities:3,active_7d:1,not_started:2,activities_passed:60,research_consent:5,
  research_consent_unanswered:2 };
it("chooses the first applicable course action and respects suppression",() => {
  expect(healthAction({...row,instructor_count:0,enrolled:0})?.label).toBe("Assign instructor");
  expect(healthAction({...row,enrolled:0,published_activities:0})?.label).toBe("Enrol students");
  expect(healthAction({...row,published_activities:0,not_started:8})?.label).toBe("Check activity availability");
  expect(healthAction({...row,not_started:4})?.label).toBe("Review student accounts");
  expect(healthAction({...row,not_started:null})).toBeNull();
});
it("renders suppressed cells and a single forecast notice",() => {
  mock.mockReturnValue({data:{generated_at:"2026-11-20T10:00:00Z",forecast_status:"ready",courses:[row,{...row,id:"b",code:"B",enrolled:1,
    active_7d:null,not_started:null,activities_passed:null,research_consent:null,research_consent_unanswered:null}] }});
  render(<CourseHealth/>);
  expect(screen.getAllByText("Not enough data yet")).toHaveLength(4);
  expect(screen.getAllByText(/not answered/)).toHaveLength(1);
  expect(screen.getByText("5 of 8", { exact: false }).textContent).toBe("5 of 8 · 2 not answered");
  expect(screen.getAllByText(/Platform forecasts/)).toHaveLength(1);
});
it("handles empty data and allows retry after an error", () => {
  const retry=vi.fn();
  mock.mockReturnValue({error:"Offline",reload:retry});
  const view=render(<CourseHealth/>);
  fireEvent.click(screen.getByRole("button",{name:"Retry"})); expect(retry).toHaveBeenCalledOnce();
  mock.mockReturnValue({data:{generated_at:"2026-11-20T00:00:00Z",forecast_status:"disabled",courses:[]}});
  view.rerender(<CourseHealth/>);
  expect(screen.getByRole("link",{name:"Create course"})).toBeTruthy();
});
