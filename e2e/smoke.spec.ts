import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Agent Pomodoro")).toBeVisible();
  });

  test("homepage has start button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("start-pomodoro-link")).toBeVisible();
  });

  test("timer page loads", async ({ page }) => {
    await page.goto("/timer");
    await expect(page.getByTestId("start-button")).toBeVisible();
  });

  test("history page loads", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Session History" })).toBeVisible();
  });

  test("navigation works", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Timer");
    await expect(page).toHaveURL(/\/timer/);
    await page.click("text=History");
    await expect(page).toHaveURL(/\/history/);
    await page.click("text=Dashboard");
    await expect(page).toHaveURL(/\/$/);
  });
});
