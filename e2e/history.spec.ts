import { test, expect } from "@playwright/test";

test.describe("History page", () => {
  test("history page loads with heading", async ({ page }) => {
    await page.goto("/history");
    await expect(
      page.getByRole("heading", { name: "Session History" })
    ).toBeVisible();
  });

  test("session list container visible", async ({ page }) => {
    await page.goto("/history");
    // The session list is wrapped in a bg-surface-light container
    const container = page.locator(".bg-surface-light.rounded-xl");
    await expect(container).toBeVisible();
  });

  test("empty state or session items visible", async ({ page }) => {
    await page.goto("/history");
    // Either shows "No sessions yet" empty state or Loading...
    // Both are valid states depending on backend data
    const emptyState = page.locator("text=No sessions yet");
    const loading = page.locator("text=Loading...");
    const sessionItem = page.locator(".bg-surface-light .space-y-1");
    // At least one of these should appear
    await expect(
      emptyState.or(loading).or(sessionItem)
    ).toBeVisible({ timeout: 10000 });
  });

  test("page has correct structure", async ({ page }) => {
    await page.goto("/history");
    // Heading should be h1
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Session History");
  });
});
