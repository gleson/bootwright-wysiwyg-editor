import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

/**
 * Fase 1 do "modo editor HTML":
 *  - importer lossless (class/style/id/data-* preservados no round-trip)
 *  - HtmlSourceDialog global (edita o HTML do documento, indentado, aplica replace)
 *  - toggle HTML ⇄ Visual no CompactEditor
 *  - caixa "Estilo inline (CSS)" na seção recolhível do Avançado
 */

test.describe('Modo HTML — round-trip lossless (HtmlSourceDialog)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => Boolean((window as any).__editor?.ui?.htmlSourceDialog),
      null, { timeout: 5000 });
  });

  async function loadParagraph(page) {
    await page.evaluate(() => {
      (window as any).__editor.loadJSON({
        type: 'root',
        children: [{
          type: 'paragraph',
          props: { text: 'Olá mundo' },
          classes: ['lead'],
          attrs: { style: 'color: rgb(255, 0, 0)' },
        }],
      });
    });
  }

  test('exportHTML/render preservam class e style inline do parágrafo', async ({ page }) => {
    await loadParagraph(page);
    const p = page.locator('.editor-canvas p.lead');
    await expect(p).toHaveText('Olá mundo');
    await expect(p).toHaveCSS('color', 'rgb(255, 0, 0)');
  });

  test('o editor de HTML mostra class/style e, ao aplicar, os preserva', async ({ page }) => {
    await loadParagraph(page);
    await page.evaluate(() => (window as any).__editor.ui.htmlSourceDialog.show());

    const dialog = page.locator('dialog.editor-html-source-dialog');
    await expect(dialog).toBeVisible();
    const ta = dialog.locator('.editor-html-source-dialog__ta');

    const val = await ta.inputValue();
    expect(val).toContain('class="lead"');
    expect(val).toContain('color: rgb(255, 0, 0)');

    // Edita o texto e a cor, mantendo a classe — round-trip não pode perder isso.
    await ta.fill('<p class="lead" style="color: rgb(0, 128, 0)">Texto novo</p>');
    await dialog.locator('button:has-text("Aplicar")').click();

    const p = page.locator('.editor-canvas p.lead');
    await expect(p).toHaveText('Texto novo');
    await expect(p).toHaveCSS('color', 'rgb(0, 128, 0)');
  });

  test('o HTML é exibido com indentação (filhos da section indentados)', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__editor.loadJSON({
        type: 'root',
        children: [{
          type: 'section',
          children: [
            { type: 'heading', props: { level: 2, text: 'Título' } },
            { type: 'paragraph', props: { text: 'Parágrafo' } },
          ],
        }],
      });
    });
    await page.evaluate(() => (window as any).__editor.ui.htmlSourceDialog.show());

    const ta = page.locator('dialog.editor-html-source-dialog .editor-html-source-dialog__ta');
    const val = await ta.inputValue();
    const lines = val.split('\n').filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(2);
    expect(val).toMatch(/\n\s{2,}<h2/);
  });

  test('input hostil (<script>/onerror) é sanitizado ao aplicar', async ({ page }) => {
    await page.evaluate(() => (window as any).__editor.ui.htmlSourceDialog.show());
    const dialog = page.locator('dialog.editor-html-source-dialog');
    const ta = dialog.locator('.editor-html-source-dialog__ta');

    await ta.fill('<p>seguro<scr' + 'ipt>window.__xss=1<\/scr' + 'ipt></p>'
      + '<img src=x onerror="window.__xss=1">');
    await dialog.locator('button:has-text("Aplicar")').click();

    const xss = await page.evaluate(() => (window as any).__xss);
    expect(xss).toBeFalsy();
    await expect(page.locator('.editor-canvas script')).toHaveCount(0);

    const html = await page.evaluate(() => (window as any).__editor.exportHTML());
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});

test.describe('Modo HTML — reconciliação (Fase 2: diff por LCS textual)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => Boolean((window as any).__editor?.ui?.htmlSourceDialog),
      null, { timeout: 5000 });
  });

  async function loadTabsAndParagraph(page) {
    return page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({
        type: 'root',
        children: [
          {
            id: 'tabsX', type: 'tabs', classes: [], attrs: {}, children: [],
            props: { items: [
              { title: 'A', content: '<p>Conteúdo A</p>' },
              { title: 'B', content: '<p>Conteúdo B</p>' },
            ] },
          },
          { id: 'paraX', type: 'paragraph', classes: [], attrs: {}, props: { text: 'original' } },
        ],
      });
      return ed.getRoot().children.map((c: any) => ({ id: c.id, type: c.type }));
    });
  }

  test('editar só o parágrafo preserva o bloco composto (Tabs) intacto — mesmo id e tipo', async ({ page }) => {
    const before = await loadTabsAndParagraph(page);
    expect(before).toEqual([
      { id: 'tabsX', type: 'tabs' },
      { id: 'paraX', type: 'paragraph' },
    ]);

    await page.evaluate(() => (window as any).__editor.ui.htmlSourceDialog.show());
    const dialog = page.locator('dialog.editor-html-source-dialog');
    const ta = dialog.locator('.editor-html-source-dialog__ta');

    // Edita SOMENTE o texto do parágrafo no fonte.
    const val = await ta.inputValue();
    expect(val).toContain('original');
    await ta.fill(val.replace('original', 'editado'));
    await dialog.locator('button:has-text("Aplicar")').click();

    const after = await page.evaluate(() =>
      (window as any).__editor.getRoot().children.map((c: any) => ({
        id: c.id, type: c.type, text: c.props?.text ?? null,
      })));

    // Tabs reaproveitado: MESMO id e tipo (não rebaixado a 'html').
    expect(after[0]).toMatchObject({ id: 'tabsX', type: 'tabs' });
    // Parágrafo foi reimportado com o novo texto (id pode mudar).
    expect(after[1].type).toBe('paragraph');
    expect(after[1].text).toContain('editado');
  });

  test('o bloco composto reaproveitado mantém seus dois itens (props.items)', async ({ page }) => {
    await loadTabsAndParagraph(page);
    await page.evaluate(() => (window as any).__editor.ui.htmlSourceDialog.show());
    const dialog = page.locator('dialog.editor-html-source-dialog');
    const ta = dialog.locator('.editor-html-source-dialog__ta');
    const val = await ta.inputValue();
    await ta.fill(val.replace('original', 'editado'));
    await dialog.locator('button:has-text("Aplicar")').click();

    const items = await page.evaluate(() =>
      (window as any).__editor.getNode('tabsX')?.props?.items?.length ?? -1);
    expect(items).toBe(2);
  });
});

test.describe('CompactEditor — toggle HTML ⇄ Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => Boolean((window as any).__editor?.ui?.compactEditor),
      null, { timeout: 5000 });
  });

  test('alterna para HTML, edita e ao voltar ao Visual aplica a mudança', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).__editor.ui.compactEditor.open({ html: '<p>antigo</p>', onSave: () => {} });
    });

    const dialog = page.locator('dialog.editor-compact-dialog');
    await expect(dialog).toBeVisible();
    const toolbar = dialog.locator('.editor-compact-toolbar');
    await expect(toolbar).toBeVisible();

    const btnHtml = dialog.locator(
      '.editor-compact-dialog__header-actions button:has-text("HTML")');
    await btnHtml.click();

    await expect(dialog).toHaveClass(/editor-compact-dialog--code/);
    await expect(toolbar).toBeHidden();
    const codeTa = dialog.locator('.editor-compact-dialog__code-ta');
    await expect(codeTa).toBeVisible();
    expect(await codeTa.inputValue()).toContain('antigo');

    await codeTa.fill('<p class="lead">novo</p>');
    const btnVisual = dialog.locator(
      '.editor-compact-dialog__header-actions button:has-text("Visual")');
    await btnVisual.click();

    await expect(dialog).not.toHaveClass(/editor-compact-dialog--code/);
    await expect(toolbar).toBeVisible();
    await expect(dialog.locator('.editor-canvas p.lead')).toHaveText('novo');
  });
});

test.describe('Inspector — caixa de estilo inline (aba Avançado)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor), null, { timeout: 5000 });
  });

  test('seção recolhível "Estilo inline & atributos" aplica CSS inline ao bloco', async ({ page }) => {
    const id = await page.evaluate(() => {
      const ed = (window as any).__editor;
      ed.loadJSON({ type: 'root', children: [{ type: 'paragraph', props: { text: 'p' } }] });
      const pid = ed.getRoot().children[0].id;
      ed.selectBlock(pid);
      return pid;
    });

    const sidebar = page.locator('.editor-sidebar--right');
    await sidebar.locator('.editor-tabs__btn[data-tab="advanced"]').click();

    const section = sidebar.locator('.editor-inspector__section');
    await expect(section).toBeVisible();
    await expect(section.locator('summary')).toContainText('Estilo inline');

    await section.locator('summary').click(); // abre o <details>
    const styleField = section.locator('textarea').first();
    await styleField.fill('color: rgb(0, 0, 255)');
    await styleField.blur();

    await expect(page.locator(`.editor-canvas [data-block-id="${id}"]`))
      .toHaveCSS('color', 'rgb(0, 0, 255)');
  });
});
