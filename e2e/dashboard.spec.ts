import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("stats period selector is visible with 3 options", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "7d" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30d" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  });

  test("7d is selected by default", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByRole("button", { name: "7d" });
    await expect(btn).toHaveClass(/text-white/);
  });

  test("clicking 30d switches active period", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "30d" }).click();
    const btn30 = page.getByRole("button", { name: "30d" });
    await expect(btn30).toHaveClass(/text-white/);
  });

  test("stat cards are visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Streak")).toBeVisible();
    await expect(page.locator("text=Focus Time")).toBeVisible();
    await expect(page.locator("text=Completion")).toBeVisible();
    await expect(page.locator("text=Since Last")).toBeVisible();
  });

  test("heatmap component renders", async ({ page }) => {
    await page.goto("/");
    // WeeklyHeatmap shows "Last 28 days" label and legend
    await expect(page.locator("text=Last 28 days")).toBeVisible();
    await expect(page.locator("text=Less")).toBeVisible();
    await expect(page.locator("text=More")).toBeVisible();
  });

  test("today's sessions section renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Today's Sessions")).toBeVisible();
  });

  test("start pomodoro button is visible on dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("start-pomodoro-link")).toBeVisible();
    await expect(page.locator("text=Start Pomodoro")).toBeVisible();
  });
});
