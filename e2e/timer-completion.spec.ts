import { test, expect, type Page } from "@playwright/test";

/**
 * Helper: start timer and fast-forward to completion.
 * Uses a small clock tick after clicking Start to ensure the interval fires
 * before the big fast-forward, avoiding flakiness with frozen clocks.
 */
async function startAndComplete(page: Page, duration: string) {
  await page.getByTestId("start-button").click();
  // Advance 1s so the setInterval tick fires and React state updates
  await page.clock.fastForward(1000);
  await expect(page.getByTestId("pause-button")).toBeVisible();
  // Fast-forward the remaining duration
  await page.clock.fastForward(duration);
}

test.describe("Timer completion flow", () => {
  test("work session completion modal appears after 25 minutes", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/timer");
    await expect(page.locator("text=25:00")).toBeVisible();

    await startAndComplete(page, "25:00");

    // Completion modal should appear
    await expect(page.locator("text=Session complete!")).toBeVisible();
  });

  test("completion modal has Save and Skip buttons", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();
    await expect(page.getByRole("button", { name: /Save/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Skip/ })).toBeVisible();
  });

  test("completion modal has clickable tags", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();

    // Tags should be visible
    const deepWorkTag = page.getByRole("button", { name: "deep-work" });
    await expect(deepWorkTag).toBeVisible();

    // Click a tag — it should toggle (get selected styling)
    await deepWorkTag.click();
    await expect(deepWorkTag).toHaveClass(/bg-pomored/);

    // Click again to deselect
    await deepWorkTag.click();
    await expect(deepWorkTag).not.toHaveClass(/bg-pomored/);
  });

  test("Skip advances timer to break mode (05:00)", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();

    // Click Skip
    await page.getByRole("button", { name: /Skip/ }).click();

    // Modal should disappear
    await expect(page.locator("text=Session complete!")).not.toBeVisible();

    // Timer should show break mode (05:00)
    await expect(page.locator("text=05:00")).toBeVisible();
    // BREAK mode button should be active (has white text)
    await expect(
      page.getByRole("button", { name: "BREAK", exact: true })
    ).toHaveClass(/text-white/);
  });

  test("Save advances timer to break mode (05:00)", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();

    // Click Save
    await page.getByRole("button", { name: /Save/ }).click();

    // Timer should show break mode (05:00)
    await expect(page.locator("text=Session complete!")).not.toBeVisible();
    await expect(page.locator("text=05:00")).toBeVisible();
  });

  test("pomodoro counter increments after completion", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await expect(page.locator("text=0 done")).toBeVisible();

    // Complete a work session
    await startAndComplete(page, "25:00");
    await expect(page.locator("text=Session complete!")).toBeVisible();
    await page.getByRole("button", { name: /Skip/ }).click();

    // Counter should show 1 done
    await expect(page.locator("text=1 done")).toBeVisible();
  });

  test("break completion auto-advances to work mode (no modal)", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/timer");

    // Complete a work session first to get to break
    await startAndComplete(page, "25:00");
    await expect(page.locator("text=Session complete!")).toBeVisible();
    await page.getByRole("button", { name: /Skip/ }).click();

    // Now in break mode (05:00)
    await expect(page.locator("text=05:00")).toBeVisible();

    // Start and complete the break
    await startAndComplete(page, "05:00");

    // Should auto-advance to work mode (no modal for breaks)
    await expect(page.locator("text=25:00")).toBeVisible();
    // FOCUS mode button should be active (has white text)
    await expect(
      page.getByRole("button", { name: "FOCUS" })
    ).toHaveClass(/text-white/);
    // No completion modal for breaks
    await expect(page.locator("text=Session complete!")).not.toBeVisible();
  });

  test("4th work session triggers long break (15:00)", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    // Complete 4 work sessions with breaks in between
    for (let i = 0; i < 4; i++) {
      // Work session
      await startAndComplete(page, "25:00");
      await expect(page.locator("text=Session complete!")).toBeVisible();
      await page.getByRole("button", { name: /Skip/ }).click();

      if (i < 3) {
        // Regular break — start and complete
        await expect(page.locator("text=05:00")).toBeVisible();
        await startAndComplete(page, "05:00");
        await expect(page.locator("text=25:00")).toBeVisible();
      }
    }

    // After 4th work session, should be LONG BREAK (15:00)
    await expect(page.locator("text=15:00")).toBeVisible();
    // LONG BREAK mode button should be active (has white text)
    await expect(
      page.getByRole("button", { name: "LONG BREAK" })
    ).toHaveClass(/text-white/);
    await expect(page.locator("text=4 done")).toBeVisible();
  });
});

test.describe("Keyboard shortcuts during completion", () => {
  test("Escape on completion modal skips", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();

    // Press Escape to skip
    await page.keyboard.press("Escape");

    // Modal should close and timer should be in break mode
    await expect(page.locator("text=Session complete!")).not.toBeVisible();
    await expect(page.locator("text=05:00")).toBeVisible();
    await expect(page.locator("text=1 done")).toBeVisible();
  });

  test("Cmd+Enter on completion modal saves", async ({ page }) => {
    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();

    // Press Cmd+Enter to save (Meta+Enter)
    await page.keyboard.press("Meta+Enter");

    // Modal should close and timer should be in break mode
    await expect(page.locator("text=Session complete!")).not.toBeVisible();
    await expect(page.locator("text=05:00")).toBeVisible();
    await expect(page.locator("text=1 done")).toBeVisible();
  });
});

test.describe("Sound and wake lock graceful degradation", () => {
  test("no console errors during timer completion in headless", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.clock.install();
    await page.goto("/timer");

    await startAndComplete(page, "25:00");

    await expect(page.locator("text=Session complete!")).toBeVisible();
    await page.getByRole("button", { name: /Skip/ }).click();

    // No JS errors should have occurred (sound + wake lock degrade gracefully)
    expect(errors).toEqual([]);
  });

  test("no console errors during break completion in headless", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.clock.install();
    await page.goto("/timer");

    // Complete work session first
    await startAndComplete(page, "25:00");
    await expect(page.locator("text=Session complete!")).toBeVisible();
    await page.getByRole("button", { name: /Skip/ }).click();

    // Complete break session
    await expect(page.locator("text=05:00")).toBeVisible();
    await startAndComplete(page, "05:00");
    await expect(page.locator("text=25:00")).toBeVisible();

    // No JS errors
    expect(errors).toEqual([]);
  });
});
