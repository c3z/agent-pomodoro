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

  test("empty state guidance text visible", async ({ page }) => {
    await page.goto("/habits");
    await expect(page.getByText("No habits yet")).toBeVisible();
  });

  test("empty state shows protocol guidance", async ({ page }) => {
    await page.goto("/habits");
    await expect(page.getByText("Start with 2-3 habits")).toBeVisible();
  });

  test("add habit form opens on button click", async ({ page }) => {
    await page.goto("/habits");
    await page.getByRole("button", { name: /Add habit/ }).click();
    await expect(page.getByPlaceholder("Habit name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hard (Phase 1)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Easy (Phase 2)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Habit" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("cancel button closes add form", async ({ page }) => {
    await page.goto("/habits");
    await page.getByRole("button", { name: /Add habit/ }).click();
    await expect(page.getByPlaceholder("Habit name")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("Habit name")).not.toBeVisible();
  });

  test("add habit button disabled without name", async ({ page }) => {
    await page.goto("/habits");
    await page.getByRole("button", { name: /Add habit/ }).click();
    await expect(page.getByRole("button", { name: "Add Habit" })).toBeDisabled();
  });

  test("phase toggle switches between hard and easy", async ({ page }) => {
    await page.goto("/habits");
    await page.getByRole("button", { name: /Add habit/ }).click();
    // Easy is default (green bg)
    const hardBtn = page.getByRole("button", { name: "Hard (Phase 1)" });
    const easyBtn = page.getByRole("button", { name: "Easy (Phase 2)" });
    await hardBtn.click();
    await expect(hardBtn).toHaveClass(/bg-pomored/);
    await easyBtn.click();
    await expect(easyBtn).toHaveClass(/bg-breakgreen/);
  });
});

test.describe("Habits navigation", () => {
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
});

test.describe("Habits in Settings", () => {
  test("settings page shows Habits API Reference section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Habits (Huberman Protocol)")).toBeVisible();
  });

  test("settings lists GET habit endpoints", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=GET /api/habits/today")).toBeVisible();
    await expect(page.locator("text=GET /api/habits/cycle")).toBeVisible();
  });

  test("settings lists POST habit endpoints", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=POST /api/habits/checkin")).toBeVisible();
    await expect(page.locator("text=POST /api/habits/update")).toBeVisible();
  });
});
