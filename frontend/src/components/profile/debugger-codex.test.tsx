import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CodexEntry } from "./debugger-codex";

afterEach(cleanup);

it.each([
  [0, 0, 1, [], "Not discovered yet"],
  [1, 2, 3, ["Loops"], "2 of 3 recoveries toward Tier II"],
  [3, 6, null, ["Loops"], "Highest tier reached"],
] as const)("renders Codex tier %i with a named meter when another tier is available", (tier, recoveries, next, topics, text) => {
  render(<CodexEntry entry={{
    category: "logic_error", label: "Logic", tier, recoveries, next_tier_at: next,
    topics: [...topics], first_recovered_at: null,
  }} />);
  expect(screen.getByRole("article", { name: "Logic" })).toBeTruthy();
  expect(screen.getByText(new RegExp(text))).toBeTruthy();
  if (next) {
    expect(screen.getByRole("progressbar", { name: /Logic progress/ }).getAttribute("max")).toBe(String(next));
  } else {
    expect(screen.queryByRole("progressbar")).toBeNull();
  }
});

it("links recorded quest concepts and leaves the General fallback as text", () => {
  render(<CodexEntry entry={{category:"logic_error",label:"Logic",tier:1,recoveries:2,next_tier_at:3,
    topics:["Strings & files","General"],first_recovered_at:null}}/>);
  expect(screen.getByRole("link",{name:"Practise Strings & files"}).getAttribute("href")).toBe("/quests?concept=Strings%20%26%20files");
  expect(screen.queryByRole("link",{name:/General/})).toBeNull();
});
