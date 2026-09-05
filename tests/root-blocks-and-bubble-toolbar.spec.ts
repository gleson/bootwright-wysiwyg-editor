import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

/**
 * Cobre as mudanças da sessão "blocos soltos na raiz":
 *  - conteúdo sem Section/container carrega e reabre sem quebrar;
 *  - loadJSON aceita as variações de forma que integrações costumam persistir;
 *  - Section oferece "sem container";
 *  - canvas tem respiro interno;
 *  - a barra flutuante de formatação só existe enquanto há seleção.
 */

test.describe('Blocos soltos na raiz (sem Section/container)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor?.ready));
  });

  test('parágrafo, título e linha podem ser inseridos direto na raiz', async ({ page }) => {
    const types = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.addBlock(ed.rootId, 'paragraph');
      ed.addBlock(ed.rootId, 'heading');
      ed.addBlock(ed.rootId, 'row');
      return ed.getRoot().children.map((c: any) => c.type);
    });
    expect(types).toEqual(['paragraph', 'heading', 'row']);

    const canvas = page.locator('.editor-canvas');
    await expect(canvas.locator('> p[data-block-type="paragraph"]')).toHaveCount(1);
    await expect(canvas.locator('> h2[data-block-type="heading"]')).toHaveCount(1);
    await expect(canvas.locator('> div[data-block-type="row"]')).toHaveCount(1);
  });

  test('o ciclo salvar → reabrir preserva blocos de topo sem container', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.addBlock(ed.rootId, 'paragraph');
      ed.addBlock(ed.rootId, 'heading');
      // "Salvar": serializa; "abrir": recarrega a mesma árvore.
      const saved = JSON.parse(JSON.stringify(ed.exportJSON()));
      ed.loadJSON(saved);
      return {
        types: ed.getRoot().children.map((c: any) => c.type),
        html: ed.exportHTML(),
      };
    });
    expect(result.types).toEqual(['paragraph', 'heading']);
    expect(result.html).toContain('<h2>');
    await expect(page.locator('.editor-canvas > [data-block-id]')).toHaveCount(2);
  });

  test('loadJSON aceita array de nós de topo (host que salvou só os children)', async ({ page }) => {
    const types = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON([
        { type: 'paragraph', props: { text: 'Solto' }, classes: [], attrs: {}, children: [] },
        { type: 'heading', props: { level: 3, text: 'Título' }, classes: [], attrs: {}, children: [] },
      ]);
      return ed.getRoot().children.map((c: any) => c.type);
    });
    expect(types).toEqual(['paragraph', 'heading']);
    await expect(page.locator('.editor-canvas > h3[data-block-type="heading"]')).toHaveText('Título');
  });

  test('loadJSON aceita objeto sem type: "root" desde que traga children', async ({ page }) => {
    const count = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({ children: [
        { type: 'paragraph', props: { text: 'A' }, classes: [], attrs: {}, children: [] },
      ] });
      return ed.getRoot().children.length;
    });
    expect(count).toBe(1);
    await expect(page.locator('.editor-canvas > p[data-block-type="paragraph"]')).toHaveText('A');
  });

  test('loadJSON aceita um nó único solto', async ({ page }) => {
    const type = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({ type: 'heading', props: { level: 1, text: 'Só um' }, classes: [], attrs: {}, children: [] });
      return ed.getRoot().children[0]?.type;
    });
    expect(type).toBe('heading');
    await expect(page.locator('.editor-canvas > h1[data-block-type="heading"]')).toHaveText('Só um');
  });

  test('loadJSON com conteúdo irreconhecível lança em vez de esvaziar em silêncio', async ({ page }) => {
    const err = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      try { ed.loadJSON({ foo: 'bar' }); return null; }
      catch (e: any) { return e.message as string; }
    });
    expect(err).toContain('formato não reconhecido');
  });
});

test.describe('Section — largura sem container', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor?.ready));
  });

  test('o controle Largura oferece "sem container" e remove as duas classes', async ({ page }) => {
    const options = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      const Section = ed.registry.get('section');
      const ctrl = Section.settings(ed.getRoot()).find((c: any) => c.label === 'Largura');
      return { values: ctrl.options.map((o: any) => o.value), group: ctrl.bind.group };
    });
    expect(options.values).toEqual(['container', 'container-fluid', '']);
    expect(options.group).toEqual(['container', 'container-fluid']);

    const classes = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'section');
      ed.updateBlock(id, { classes: [] });
      return ed.renderer.nodeElements.get(id).className;
    });
    expect(classes).not.toContain('container');
  });
});

test.describe('Canvas — respiro interno', () => {
  test('o canvas tem padding, então o conteúdo não encosta na borda', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor?.ready));
    const padding = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.editor-canvas')!);
      return { top: parseFloat(cs.paddingTop), left: parseFloat(cs.paddingLeft), box: cs.boxSizing };
    });
    expect(padding.top).toBeGreaterThan(8);
    expect(padding.left).toBeGreaterThan(8);
    expect(padding.box).toBe('border-box');
  });
});

test.describe('RichTextToolbar — bubble menu de seleção', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor?.ready));
    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({ type: 'root', children: [
        { id: 'p1', type: 'paragraph', props: { text: 'Uma frase de teste bem longa' },
          classes: [], attrs: {}, children: [] },
      ] });
    });
  });

  test('sem seleção (caret colapsado) a barra não fica visível', async ({ page }) => {
    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.startInlineEdit('p1', 'text', { html: true });
    });
    await expect(page.locator('.editor-rich-toolbar')).toBeHidden();
  });

  test('selecionar texto mostra a barra acima da seleção', async ({ page }) => {
    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.startInlineEdit('p1', 'text', { html: true });
      const el = ed.renderer.nodeElements.get('p1');
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    });
    const toolbar = page.locator('.editor-rich-toolbar');
    await expect(toolbar).toBeVisible();

    // Fica acima do texto e sem sobrepô-lo.
    const gap = await page.evaluate(() => {
      const tb = document.querySelector('.editor-rich-toolbar')!.getBoundingClientRect();
      const p  = document.querySelector('[data-block-id="p1"]')!.getBoundingClientRect();
      return p.top - tb.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(0);
  });

  test('desfazer a seleção esconde a barra', async ({ page }) => {
    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.startInlineEdit('p1', 'text', { html: true });
      const el = ed.renderer.nodeElements.get('p1');
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await expect(page.locator('.editor-rich-toolbar')).toBeVisible();

    await page.evaluate(() => {
      const sel = document.getSelection()!;
      sel.collapseToEnd();
    });
    await expect(page.locator('.editor-rich-toolbar')).toBeHidden();
  });

  test('terminar a edição inline remove a barra do DOM', async ({ page }) => {
    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.startInlineEdit('p1', 'text', { html: true });
      const el = ed.renderer.nodeElements.get('p1');
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await expect(page.locator('.editor-rich-toolbar')).toBeVisible();

    await page.evaluate(() => (window as any).__editor.commitInlineEdit());
    await expect(page.locator('.editor-rich-toolbar')).toHaveCount(0);
  });
});
