import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

test.describe('BlockToolbar — botão "Salvar como padrão"', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor), null, { timeout: 5000 });
  });

  test('o botão aparece na toolbar do bloco selecionado', async ({ page }) => {
    // arrange: insere um bloco e seleciona-o programaticamente
    const id = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      const newId = ed.addBlock(ed.rootId, 'paragraph');
      ed.selectBlock(newId);
      return newId;
    });
    expect(id).toBeTruthy();

    const btn = page.locator('.editor-block-toolbar .editor-block-toolbar__btn:has(i.bi-bookmark-plus)');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('title', /padrão/i);
  });

  test('clicar no botão abre o prompt, e ao confirmar cria um template novo', async ({ page }) => {
    // arrange: estado limpo do customizations + bloco selecionado
    const initialTemplates: number = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      return ed.customizations.listTemplates().length;
    });

    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      const newId = ed.addBlock(ed.rootId, 'paragraph');
      ed.selectBlock(newId);
    });

    // act: clica no botão, preenche o prompt e confirma
    await page.locator('.editor-block-toolbar__btn:has(i.bi-bookmark-plus)').click();

    const promptInput = page.locator('dialog input[type="text"], .editor-notify-dialog input[type="text"]').first();
    await expect(promptInput).toBeVisible();
    await promptInput.fill('Padrão de Teste E2E');

    // o botão OK costuma estar dentro do dialog. Procuramos pelo label "Salvar".
    await page.locator('dialog button:has-text("Salvar"), .editor-notify-dialog button:has-text("Salvar")').first().click();

    // assert: novo template foi registrado no store de customizações
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const ed: any = (window as any).__editor;
        return ed.customizations.listTemplates().length;
      });
    }).toBe(initialTemplates + 1);

    const lastName = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      const list = ed.customizations.listTemplates();
      return list[list.length - 1].name;
    });
    expect(lastName).toBe('Padrão de Teste E2E');
  });

  test('cancelar o prompt não cria template', async ({ page }) => {
    const before: number = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      return ed.customizations.listTemplates().length;
    });

    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      const newId = ed.addBlock(ed.rootId, 'paragraph');
      ed.selectBlock(newId);
    });

    await page.locator('.editor-block-toolbar__btn:has(i.bi-bookmark-plus)').click();
    await expect(page.locator('dialog input, .editor-notify-dialog input').first()).toBeVisible();

    // cancelar via Esc — Notify deve fechar o dialog
    await page.keyboard.press('Escape');

    const after: number = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      return ed.customizations.listTemplates().length;
    });
    expect(after).toBe(before);
  });
});
