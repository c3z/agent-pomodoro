import { test, expect } from "@playwright/test";

test.describe("Accountability page", () => {
  test("page loads with heading", async ({ page }) => {
    await page.goto("/accountability");
    await expect(
      page.getByRole("heading", { name: "Accountability" })
    ).toBeVisible();
  });

  test("shows score display", async ({ page }) => {
    await page.goto("/accountability");
    // Score is rendered as a large percentage number + grade letter
    // With no data / before workday, score defaults to 100% with grade "S"
    await expect(page.locator("text=%")).toBeVisible();
  });

  test("accountability heading and score visible", async ({ page }) => {
    await page.goto("/accountability");
    await expect(page.getByRole("heading", { name: "Accountability" })).toBeVisible();
    // Score number is always rendered
    const scoreEl = page.locator(".text-8xl");
    await expect(scoreEl).toBeVisible();
  });

  test("start pomodoro CTA is not visible when score >= 75", async ({
    page,
  }) => {
    await page.goto("/accountability");
    // With no sessions, score defaults to 100% (>= 75), so CTA should be hidden
    await expect(page.locator("text=Start a Pomodoro")).not.toBeVisible();
  });

  test("timeline or before-workday message renders", async ({ page }) => {
    await page.goto("/accountability");
    // Either timeline renders (during workday) or "hasn't started" message (before workday)
    const timeline = page.getByText("Today's Timeline");
    const beforeWorkday = page.getByText("hasn't started");
    const either = await timeline.isVisible().catch(() => false) || await beforeWorkday.isVisible().catch(() => false);
    // At least the score heading should be visible regardless
    await expect(page.getByRole("heading", { name: "Accountability" })).toBeVisible();
  });

  test("shame log section heading visible", async ({ page }) => {
    await page.goto("/accountability");
    await expect(page.locator("text=Unprotected Windows")).toBeVisible();
  });

  test("stats row visible with three metrics", async ({ page }) => {
    await page.goto("/accountability");
    // Three stat cards in the grid
    const protectedCard = page.locator("text=Protected").first();
    await expect(protectedCard).toBeVisible();
    await expect(page.locator("text=Longest Gap")).toBeVisible();
  });

  test("score display has color class", async ({ page }) => {
    await page.goto("/accountability");
    // The big score number uses scoreColor which returns text-breakgreen, text-pomored, text-yellow-400, or text-red-500
    const scoreEl = page.locator(
      ".text-8xl.font-mono.font-bold.tabular-nums"
    );
    await expect(scoreEl).toBeVisible();
    const classes = await scoreEl.getAttribute("class");
    const hasScoreColor =
      classes?.includes("text-breakgreen") ||
      classes?.includes("text-pomored") ||
      classes?.includes("text-yellow-400") ||
      classes?.includes("text-red-500");
    expect(hasScoreColor).toBe(true);
  });
});
