import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

/**
 * CompactEditor — botão "modo completo" e flag allowFullMode.
 *
 * Modo completo revela a topbar nativa do sub-editor + as duas sidebars e
 * oculta a barra compacta (toggle in-place no mesmo dialog). A flag
 * allowFullMode=false (campos de comentário/anotação) remove o botão.
 */
test.describe('CompactEditor — modo completo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => Boolean((window as any).__editor?.ui?.compactEditor),
      null, { timeout: 5000 });
  });

  test('botão alterna para modo completo: revela sidebars, oculta barra compacta', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__editor.ui.compactEditor.open({ html: '<p>oi</p>', onSave: () => {} });
    });

    const dialog = page.locator('dialog.editor-compact-dialog');
    await expect(dialog).toBeVisible();

    const sidebar = dialog.locator('.editor-sidebar').first();
    const toolbar = dialog.locator('.editor-compact-toolbar');
    // Compacto: sidebars ocultas, barra compacta visível.
    await expect(sidebar).toBeHidden();
    await expect(toolbar).toBeVisible();

    const btnFull = dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo completo")');
    await expect(btnFull).toBeVisible();
    await btnFull.click();

    // Completo: sidebars visíveis, barra compacta oculta, topbar nativa visível.
    await expect(sidebar).toBeVisible();
    await expect(toolbar).toBeHidden();
    await expect(dialog.locator('.editor-compact-dialog__ghost-topbar')).toBeVisible();
    await expect(dialog).toHaveClass(/editor-compact-dialog--full/);

    // O botão agora oferece voltar ao compacto.
    const btnCompact = dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo compacto")');
    await expect(btnCompact).toBeVisible();
    await btnCompact.click();
    await expect(sidebar).toBeHidden();
    await expect(toolbar).toBeVisible();
  });

  test('allowFullMode:false esconde o botão (campo travado em compacto)', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__editor.ui.compactEditor.open({
        html: '<p>comentário</p>', allowFullMode: false, onSave: () => {},
      });
    });

    const dialog = page.locator('dialog.editor-compact-dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo completo")'),
    ).toHaveCount(0);
    // Salvar/Cancelar continuam presentes.
    await expect(dialog.locator('.editor-compact-dialog__header-actions button')).toHaveCount(2);
  });
});
