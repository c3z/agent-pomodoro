import { test, expect } from "@playwright/test";

test.describe("Timer flow", () => {
  test("timer displays 25:00 by default", async ({ page }) => {
    await page.goto("/timer");
    await expect(page.locator("text=25:00")).toBeVisible();
  });

  test("mode buttons are visible", async ({ page }) => {
    await page.goto("/timer");
    await expect(page.getByRole("button", { name: "FOCUS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "BREAK", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "LONG BREAK" })).toBeVisible();
  });

  test("switching to break mode shows 05:00", async ({ page }) => {
    await page.goto("/timer");
    await page.click("text=BREAK");
    await expect(page.locator("text=05:00")).toBeVisible();
  });

  test("switching to long break shows 15:00", async ({ page }) => {
    await page.goto("/timer");
    await page.click("text=LONG BREAK");
    await expect(page.locator("text=15:00")).toBeVisible();
  });

  test("start button starts the timer", async ({ page }) => {
    await page.goto("/timer");
    await page.getByTestId("start-button").click();
    // Timer should be counting — 24:59 should appear within 2 seconds
    await expect(page.locator("text=24:59")).toBeVisible({ timeout: 3000 });
    // Pause button should be visible now
    await expect(page.getByTestId("pause-button")).toBeVisible();
  });

  test("pause and resume work", async ({ page }) => {
    await page.goto("/timer");
    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("pause-button")).toBeVisible();
    await page.getByTestId("pause-button").click();
    // After pause, start button should reappear
    await expect(page.getByTestId("start-button")).toBeVisible();
  });

  test("reset stops the timer", async ({ page }) => {
    await page.goto("/timer");
    await page.getByTestId("start-button").click();
    await page.waitForTimeout(1100);
    await page.getByTestId("stop-button").click();
    await expect(page.locator("text=25:00")).toBeVisible();
  });

  test("pomodoro counter shows 0 done initially", async ({ page }) => {
    await page.goto("/timer");
    await expect(page.locator("text=0 done")).toBeVisible();
  });
});
