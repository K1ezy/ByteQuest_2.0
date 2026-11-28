import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import Page from "./page";

vi.mock("next/navigation", () => ({useRouter:()=>({replace:vi.fn()}),useSearchParams:()=>new URLSearchParams("sort=attention")}));
vi.mock("@/components/workspace/workspace-provider", () => ({useWorkspace:()=>({courseId:"c",courseHref:(path:string)=>path,profile:{workshop_languages:["python"]}})}));
const mock=vi.hoisted(()=>vi.fn());
vi.mock("@/components/workspace/ui", async orig => ({...await orig<typeof import("@/components/workspace/ui")>(),useApi:mock}));
afterEach(cleanup);
it("sorts published activity health by stuck learners then pass rate and links to the filtered roster", () => {
  const samples=[["Z",1,0.8],["A",1,0.5],["B",3,0.9]] as const;
  mock.mockReturnValue({data:{counts:{},items:samples.map(([title,stuck,pass_rate])=>({
    activity_id:title,title,topic_concept:"Loops",language:"python",activity_type:"quiz",state:"open",review_status:"published",
    question_count:3,version_number:1,attempt_count:10,health:{passed:2,attempted:5,not_started:2,stuck,pass_rate}
  }))}});
  render(<Page/>);
  const rows=within(screen.getByRole("list",{name:"Activities"})).getAllByRole("listitem");
  expect(rows.map(r=>within(r).getByRole("heading").textContent)).toEqual(["B","A","Z"]);
  expect(rows[0].textContent).toContain("2 of 7 passed · 3 stuck · 2 not started");
  expect(within(rows[0]).getByRole("link",{name:"3 stuck"}).getAttribute("href")).toBe("/instructor/performance?activity=B&stuck=1");
});
