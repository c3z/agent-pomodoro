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

  test("working hours labels are visible", async ({ page }) => {
    await page.goto("/accountability");
    // Timeline bar shows workday hour labels (default 9:00 - 18:00)
    await expect(page.locator("text=9:00")).toBeVisible();
    await expect(page.locator("text=18:00")).toBeVisible();
  });

  test("start pomodoro CTA is not visible when score >= 75", async ({
    page,
  }) => {
    await page.goto("/accountability");
    // With no sessions, score defaults to 100% (>= 75), so CTA should be hidden
    await expect(page.locator("text=Start a Pomodoro")).not.toBeVisible();
  });

  test("timeline bar renders with legend", async ({ page }) => {
    await page.goto("/accountability");
    await expect(page.locator("text=Today's Timeline")).toBeVisible();
    // Timeline legend items
    await expect(page.locator("text=Protected")).toBeVisible();
    await expect(page.locator("text=Unprotected")).toBeVisible();
    await expect(page.locator("text=Future")).toBeVisible();
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
