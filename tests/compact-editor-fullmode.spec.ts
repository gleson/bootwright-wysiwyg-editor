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

  test('o cabeçalho reflete o modo: título e tema trocam e revertem', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__editor.ui.compactEditor.open({ html: '<p>oi</p>', onSave: () => {} });
    });

    const dialog = page.locator('dialog.editor-compact-dialog');
    await expect(dialog).toBeVisible();

    const titleText = dialog.locator('.editor-compact-dialog__title-text');
    const header = dialog.locator('.editor-compact-dialog__header');
    const darkBg = 'rgb(31, 41, 55)';
    const lightBg = 'rgb(255, 255, 255)';

    // Compacto: título "Editor rápido", cabeçalho escuro.
    await expect(titleText).toHaveText('Editor rápido');
    await expect(header).toHaveCSS('background-color', darkBg);

    // Completo: título original do editor (brand da topbar), cabeçalho claro.
    const editorBrand = (await page.locator('.editor-topbar__brand').first().textContent())!
      .replace(/\s+/g, ' ').trim();
    await dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo completo")').click();
    await expect(titleText).toHaveText(editorBrand);
    await expect(header).toHaveCSS('background-color', lightBg);

    // Voltar ao compacto reverte ambos (regressão: antes ficava preso no escuro/"Editor rápido").
    await dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo compacto")').click();
    await expect(titleText).toHaveText('Editor rápido');
    await expect(header).toHaveCSS('background-color', darkBg);
  });

  test('em modo completo o botão "esconder painéis" da topbar nativa oculta as sidebars', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__editor.ui.compactEditor.open({ html: '<p>oi</p>', onSave: () => {} });
    });

    const dialog = page.locator('dialog.editor-compact-dialog');
    await expect(dialog).toBeVisible();

    // Entra no modo completo: sidebars visíveis.
    await dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo completo")').click();
    const sidebar = dialog.locator('.editor-sidebar--left');
    await expect(sidebar).toBeVisible();

    // Botão "esconder painéis" (Ctrl+\) da topbar nativa, agora revelada.
    const hideBtn = dialog
      .locator('.editor-compact-dialog__ghost-topbar .editor-topbar__group--start button')
      .first();

    // Regressão: o !important do modo completo vencia o toggle e o botão "não fazia nada".
    await hideBtn.click();
    await expect(sidebar).toBeHidden();
    await hideBtn.click();
    await expect(sidebar).toBeVisible();
  });

  test('allowFullMode:false esconde o botão (campo travado em compacto)', async ({ page }) => {
    // Campo de edição leve (comentário): trava tanto o modo completo quanto o
    // editor de HTML cru. Sem allowHtmlMode:false o botão "HTML" apareceria
    // (default true), então passamos ambos para o cenário realista de campo leve.
    await page.evaluate(() => {
      (window as any).__editor.ui.compactEditor.open({
        html: '<p>comentário</p>', allowFullMode: false, allowHtmlMode: false, onSave: () => {},
      });
    });

    const dialog = page.locator('dialog.editor-compact-dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('.editor-compact-dialog__header-actions button:has-text("Modo completo")'),
    ).toHaveCount(0);
    await expect(
      dialog.locator('.editor-compact-dialog__header-actions button:has-text("HTML")'),
    ).toHaveCount(0);
    // Salvar/Cancelar continuam presentes.
    await expect(dialog.locator('.editor-compact-dialog__header-actions button')).toHaveCount(2);
  });
});
