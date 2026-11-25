import { expect, test } from "@playwright/test";
import { expectContentToFit } from "./containment";

test("workshop covers and owner photos fit the cards and fall back safely", async ({ page }, info) => {
  const id = "f0000000-0000-4000-8000-000000000011";
  await page.addInitScript(({ id, enlarged }) => {
    sessionStorage.setItem("sb-127-auth-token", JSON.stringify({
      access_token: "layout-test-token",
      refresh_token: "layout-test-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, email: "layout-student@example.test" },
    }));
    if (enlarged) document.addEventListener("DOMContentLoaded", () => {
      document.documentElement.style.fontSize = "200%";
    }, { once: true });
  }, { id, enlarged: info.project.name === "large-text" });
  const owner = "María Alexandra " + "longunbrokenname".repeat(5);
  const title = "Introduction to writing reusable functions " + "longunbrokentopic".repeat(5);
  const workshop = {
    description: null, language: "python", is_owner: false, owned_by_me: false, join_code: null,
    joining_enabled: true, archived: false, owner_name: owner, member_count: 2, activity_ids: [],
    activities: [], next_closes_at: null,
  };
  await page.route("**/api/v1/profile/me", (route) => route.fulfill({ json: {
    id, role: "student", username: "layout-student", enrolled_language: "python",
  } }));
  await page.route("**/api/v1/workshops", (route) => route.fulfill({ json: [
    { ...workshop, id: "with-photo", name: title, owner_avatar_url: "/illustrations/quest-scroll-purple.png",
      cover_image: "/workshop-covers/cs122-python.webp" },
    { ...workshop, id: "no-photo", name: "No photo workshop", owner_avatar_url: null },
    { ...workshop, id: "broken-photo", name: "Unavailable photo workshop", owner_avatar_url: "/layout/avatar-unavailable.png",
      cover_image: "/workshop-covers/unavailable.webp" },
  ] }));
  await page.route("**/api/v1/workshops/with-photo", (route) => route.fulfill({ json: {
    ...workshop, id: "with-photo", name: title, cover_image: "/workshop-covers/cs122-python.webp",
  } }));
  await page.route(/\/api\/v1\/workshops\/with-photo\/(announcements|upcoming)$/, (route) => route.fulfill({ json: [] }));
  await page.route("**/layout/avatar-unavailable.png", (route) => route.fulfill({ status: 404 }));
  await page.route("**/workshop-covers/unavailable.webp", (route) => route.fulfill({ status: 404 }));
  await page.goto("/workshops");

  const card = page.locator('a[href="/workshops/with-photo"]');
  const photo = card.locator(".workshop-card-avatar img");
  const cover = card.locator(".workshop-banner-photo");
  const coverPath = /\/workshop-covers\/cs122-python\.webp$/;
  await expect(cover).toHaveAttribute("src", coverPath);
  await expect.poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(photo).toHaveAttribute("alt", `${owner}'s profile photo`);
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expectContentToFit(page, card, [".workshop-card-avatar", ".workshop-card-copy", "h3", "p"]);
  expect(await card.evaluate((element) => {
    const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const avatar = box(".workshop-card-avatar");
    return avatar.top < box(".workshop-banner").bottom
      && avatar.bottom > box(".workshop-banner").bottom
      && avatar.bottom <= box("h3").top;
  })).toBe(true);
  for (const id of ["no-photo", "broken-photo"]) {
    const fallbackCard = page.locator(`a[href="/workshops/${id}"]`);
    await fallbackCard.scrollIntoViewIfNeeded();
    await expect(fallbackCard.locator(".user-avatar-identicon")).toBeVisible();
    await expect(fallbackCard.locator(".workshop-banner-illustration")).toBeVisible();
  }
  await card.click();
  const boardCover = page.locator(".workshop-page > .workshop-banner");
  await expect(boardCover.locator("h1")).toHaveText(title);
  await expect(boardCover.locator(".workshop-banner-photo")).toHaveAttribute("src", coverPath);
  await expectContentToFit(page, boardCover, [".workshop-banner-content", "h1", "p"]);
});
