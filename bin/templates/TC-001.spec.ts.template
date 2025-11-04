import { test, expect } from '@zest-pw/test';
test('Check page title', async ({ page }) => {

  await test.step('Open site', async () => { 
    await page.goto('https://playwright.dev'); 
  });

  await test.step('Title check', async () => { 
    await expect(page).toHaveTitle(/Playwright/); 
  });
    
});

