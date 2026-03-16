import { test, expect } from "@playwright/test";

test.describe("Habits page", () => {
  test("habits page loads with heading", async ({ page }) => {
    await page.goto("/habits");
    await expect(page.getByRole("heading", { name: "Habits" })).toBeVisible();
  });

  test("add habit button visible on empty state", async ({ page }) => {
    await page.goto("/habits");
    await expect(page.getByRole("button", { name: /Add habit/ })).toBeVisible();
  });

  test("navigation includes Habits link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Habits" })).toBeVisible();
  });

  test("habits link navigates to /habits", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Habits" }).click();
    await expect(page.getByRole("heading", { name: "Habits" })).toBeVisible();
    expect(page.url()).toContain("/habits");
  });

  test("settings page shows Habits API Reference section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Habits (Huberman Protocol)")).toBeVisible();
  });

  test("settings lists habit endpoints", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=GET /api/habits/today")).toBeVisible();
    await expect(page.locator("text=POST /api/habits/checkin")).toBeVisible();
  });
});
