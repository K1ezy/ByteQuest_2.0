import { expect, type Locator, type Page } from "@playwright/test";

/** Check the component boundary as well as the page so a wide card cannot hide its own overflow. */
export async function expectContentToFit(page: Page, container: Locator, selectors: string[]) {
  await expect(container).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const violations = await container.evaluate((element, targets) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const top = bounds.top + element.clientTop + parseFloat(style.paddingTop);
    const viewport = document.documentElement;
    const tolerance = 1;
    const issues: string[] = [];
    if (viewport.scrollWidth > viewport.clientWidth + tolerance) {
      issues.push(`Page scrolls horizontally (${viewport.scrollWidth}px in ${viewport.clientWidth}px)`);
    }
    if (bounds.left < -tolerance || bounds.right > viewport.clientWidth + tolerance) {
      issues.push(`Container extends past the viewport (${bounds.left}…${bounds.right})`);
    }
    for (const selector of targets) {
      const matches = element.querySelectorAll(selector);
      if (!matches.length) issues.push(`Missing layout target ${selector}`);
      for (const match of matches) {
        const rect = match.getBoundingClientRect();
        if (rect.left < bounds.left - tolerance || rect.right > bounds.right + tolerance
          || rect.top < top - tolerance || rect.bottom > bounds.bottom + tolerance) {
          issues.push(`${selector} extends outside its container`);
        }
        if (match.clientWidth > 0 && match.scrollWidth > match.clientWidth + tolerance) {
          issues.push(`${selector} has clipped or overflowing content`);
        }
      }
    }
    return issues;
  }, selectors);
  expect(violations).toEqual([]);
}
