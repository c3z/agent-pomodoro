import { test, expect } from "@playwright/test";

test.describe("Settings page", () => {
  test("settings page loads with heading", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" })
    ).toBeVisible();
    await expect(page.locator("text=Preferences and API keys")).toBeVisible();
  });

  test("Timer Durations section visible with 4 inputs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Timer Durations")).toBeVisible();
    await expect(page.locator("text=Focus (min)")).toBeVisible();
    await expect(page.locator("text=Break (min)")).toBeVisible();
    await expect(page.locator("text=Long break (min)")).toBeVisible();
    await expect(page.locator("text=Long break every")).toBeVisible();
  });

  test("Work Schedule section visible with hour inputs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Work Schedule")).toBeVisible();
    await expect(page.locator("text=Start hour")).toBeVisible();
    await expect(page.locator("text=End hour")).toBeVisible();
  });

  test("Sound toggle visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Sound")).toBeVisible();
    // Should show either "Sounds enabled" or "Sounds muted"
    const toggle = page.locator('button[role="switch"]').first();
    await expect(toggle).toBeVisible();
  });

  test("Daily Goals section visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Daily Goals")).toBeVisible();
    await expect(page.locator("text=Daily pomodoros target")).toBeVisible();
    await expect(page.locator("text=Weekly focus hours target")).toBeVisible();
  });

  test("API Reference section shows endpoints", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=API Reference")).toBeVisible();
    await expect(page.locator("text=GET /api/status")).toBeVisible();
    await expect(page.locator("text=POST /api/sessions/start")).toBeVisible();
    await expect(
      page.locator("text=POST /api/activity/heartbeat")
    ).toBeVisible();
  });

  test("Create API Key form visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Create API Key")).toBeVisible();
    await expect(
      page.locator('input[placeholder="Key name (e.g. atropa-agent)"]')
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create" })
    ).toBeVisible();
  });

  test("can type in key name input", async ({ page }) => {
    await page.goto("/settings");
    const input = page.locator(
      'input[placeholder="Key name (e.g. atropa-agent)"]'
    );
    await input.fill("test-agent");
    await expect(input).toHaveValue("test-agent");
  });

  test("Enforce breaks toggle visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Enforce breaks")).toBeVisible();
    await expect(
      page.locator(
        "text=Blocks starting focus until you take a break after each work session"
      )
    ).toBeVisible();
  });

  test("Reset to defaults button visible in Timer Durations", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("button", { name: "Reset to defaults" })
    ).toBeVisible();
  });

  test("Sessions and Activity endpoint sections exist", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Sessions").first()).toBeVisible();
    await expect(page.locator("text=Activity").first()).toBeVisible();
    await expect(page.locator("text=Goals").last()).toBeVisible();
  });
});
