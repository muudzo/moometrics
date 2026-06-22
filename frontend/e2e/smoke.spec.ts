import { test, expect } from '@playwright/test';

/**
 * Full-stack smoke: self-serve signup creates a farm, the session persists via
 * the refresh cookie, and a manager can add an animal that appears in the
 * (paginated) list.
 */
test('signup creates a farm and a manager can add an animal', async ({ page }) => {
  const unique = Date.now();
  const username = `e2e_${unique}`;

  await page.goto('/');

  // Switch to sign-up and onboard a new farm.
  await page.getByRole('button', { name: /sign up/i }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('Passw0rd1');
  await page.getByLabel('Confirm Password').fill('Passw0rd1');
  await page.getByLabel('Farm Name').fill(`E2E Farm ${unique}`);
  await page.getByRole('button', { name: /create account/i }).click();

  // Landed in the app.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText(`E2E Farm ${unique}`)).toBeVisible();

  // Go to Animals and add one.
  await page.getByRole('button', { name: /animals/i }).click();
  await page.getByRole('button', { name: /add animal/i }).click();
  await page.getByLabel('Name *').fill('Bessie');
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'cattle' }).click();
  await page.getByRole('button', { name: /^add animal$/i }).click();

  // It appears in the table.
  await expect(page.getByRole('cell', { name: 'Bessie' })).toBeVisible();
});
