import { test, expect } from '@playwright/test';

test('strona główna i nawigacja do uploadu', async ({ page }) => {
  // Wejdź na stronę główną
  await page.goto('http://localhost:3000');
  
  // Sprawdź czy tytuł zgadza się
  await expect(page).toHaveTitle(/AnyDataNext/);
  
  // Sprawdź czy jest link do uploadu i kliknij go
  const uploadLink = page.locator('a[href="/upload"]');
  await expect(uploadLink).toBeVisible();
  await uploadLink.click();
  
  // Sprawdź czy wylądowaliśmy na stronie upload
  await expect(page.url()).toContain('/upload');
  
  // Sprawdź czy jest input do pliku
  await expect(page.locator('input[type="file"]')).toBeVisible();
});