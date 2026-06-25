import { expect, test } from "@playwright/test";

test("reviewer can open the sample incident report", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", {
      name: "Understand why a system failed before the next alert fires.",
    }),
  ).toBeVisible();

  const sampleButton = page.getByRole("button", { name: "View sample report" });
  await expect(sampleButton).toBeEnabled();
  await sampleButton.click();

  await expect(page.getByRole("heading", { name: /Checkout requests failed/ })).toBeVisible();
  await expect(page.getByText("Likely root cause", { exact: true })).toBeVisible();
  await expect(page.getByText("Reconstructed timeline", { exact: true })).toBeVisible();
  await expect(page.getByText("91%", { exact: true })).toBeVisible();
});
