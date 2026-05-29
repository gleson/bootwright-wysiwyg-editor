import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

test.describe('Editor WYSIWYG — smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('a casca do editor é montada com topbar, canvas e sidebars', async ({ page }) => {
    await expect(page).toHaveTitle(/Editor WYSIWYG/);

    const root = page.locator('#editor-root');
    await expect(root).toBeVisible();

    await expect(page.locator('.editor-topbar')).toBeVisible();
    await expect(page.locator('.editor-canvas')).toBeVisible();
    await expect(page.locator('.editor-sidebar--left')).toBeVisible();
    await expect(page.locator('.editor-sidebar--right')).toBeVisible();
  });

  test('topbar expõe os botões de undo, redo e salvar', async ({ page }) => {
    await expect(page.locator('[data-action="undo"]')).toBeVisible();
    await expect(page.locator('[data-action="redo"]')).toBeVisible();
    await expect(page.locator('[data-action="save"]')).toBeVisible();
  });

  test('topbar expõe os seletores de dispositivo (desktop/tablet/mobile)', async ({ page }) => {
    await expect(page.locator('button[data-device="desktop"]')).toBeVisible();
    await expect(page.locator('button[data-device="tablet"]')).toBeVisible();
    await expect(page.locator('button[data-device="mobile"]')).toBeVisible();
  });

  test('o canvas inicia no modo desktop', async ({ page }) => {
    const canvas = page.locator('.editor-canvas');
    await expect(canvas).toHaveAttribute('data-device', 'desktop');
  });

  test('a instância do editor é exposta em window.__editor', async ({ page }) => {
    await page.waitForFunction(() => Boolean((window as any).__editor), null, { timeout: 5000 });
    const hasBus = await page.evaluate(() => Boolean((window as any).__editor?.bus));
    expect(hasBus).toBe(true);
  });
});
