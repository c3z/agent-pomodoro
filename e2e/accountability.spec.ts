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
});
