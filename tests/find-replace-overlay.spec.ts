import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

test.describe('FindReplace — overlay sobre o canvas + toggle no botão', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor), null, { timeout: 5000 });
  });

  test('o painel abre como overlay (position: absolute) e não desloca o canvas', async ({ page }) => {
    const canvas = page.locator('.editor-canvas');
    const canvasBoxBefore = await canvas.boundingBox();
    expect(canvasBoxBefore).not.toBeNull();

    await page.locator('.editor-topbar .btn:has(i.bi-binoculars)').first().click();

    const panel = page.locator('.editor-find-replace');
    await expect(panel).toBeVisible();

    const position = await panel.evaluate((el) => window.getComputedStyle(el).position);
    expect(position).toBe('absolute');

    const canvasBoxAfter = await canvas.boundingBox();
    expect(canvasBoxAfter).not.toBeNull();
    expect(Math.abs((canvasBoxAfter!.y) - (canvasBoxBefore!.y))).toBeLessThan(2);
    expect(Math.abs((canvasBoxAfter!.height) - (canvasBoxBefore!.height))).toBeLessThan(2);
  });

  test('o painel fica ancorado no canto superior direito do canvas-wrapper', async ({ page }) => {
    await page.locator('.editor-topbar .btn:has(i.bi-binoculars)').first().click();
    const panel = page.locator('.editor-find-replace');
    await expect(panel).toBeVisible();

    const wrapper = page.locator('[data-region="canvas-wrapper"]');
    const wrapperBox = await wrapper.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(wrapperBox).not.toBeNull();
    expect(panelBox).not.toBeNull();

    expect(panelBox!.x + panelBox!.width).toBeGreaterThan(wrapperBox!.x + wrapperBox!.width * 0.5);
    expect(panelBox!.y).toBeLessThan(wrapperBox!.y + 50);
  });

  test('clicar novamente no ícone fecha o painel (toggle)', async ({ page }) => {
    const btn = page.locator('.editor-topbar .btn:has(i.bi-binoculars)').first();
    const panel = page.locator('.editor-find-replace');

    await btn.click();
    await expect(panel).toBeVisible();

    await btn.click();
    await expect(panel).toHaveCount(0);
  });

  test('Esc continua fechando o painel', async ({ page }) => {
    await page.locator('.editor-topbar .btn:has(i.bi-binoculars)').first().click();
    const panel = page.locator('.editor-find-replace');
    await expect(panel).toBeVisible();

    await page.locator('.editor-find-replace__input').first().press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('Ctrl+F abre o painel (e não fecha em re-pressionamento — só toggle no botão)', async ({ page }) => {
    const panel = page.locator('.editor-find-replace');

    await page.locator('.editor-canvas').click();
    await page.keyboard.press('Control+F');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Control+F');
    await expect(panel).toBeVisible();
  });
});
