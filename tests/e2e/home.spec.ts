import { expect, test } from "@playwright/test";

test("home page presents the core service heading", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Custom software for businesses that have outgrown spreadsheets.",
    }),
  ).toBeVisible();
});
