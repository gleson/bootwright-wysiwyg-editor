import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

/**
 * Regressão da edição de blocos compostos (Tabs/Acordeão/Carrossel) no canvas
 * — abordagem híbrida (canvas + modal avançado).
 *
 * Cobre:
 *  - Perda de dados: editar um painel inline (duplo-clique → getInlineEditTarget
 *    → commit) NÃO pode apagar img/button/iframe inseridos via modal. Causa
 *    histórica: perfil de sanitização inline (RICH_TEXT_FULL) ≠ perfil do
 *    armazenamento (BLOCK_CONTENT). Corrigido unificando em BLOCK_CONTENT.
 *  - PaneEditButton: reposiciona sobre o painel/slide ativo após navegar
 *    (slid.bs.carousel / shown.bs.collapse).
 */
test.describe('Blocos compostos — edição no canvas', () => {
  test.beforeEach(async ({ page }) => {
    // O teste de XSS injeta `<img src=x onerror="alert(1)">` no DOM vivo; a
    // falha de carregamento dispara um `alert` ASSÍNCRONO que, sem tratamento,
    // surge durante o teardown ou o próximo teste e deixa a suíte instável
    // (~1/3 de falhas). O teste valida a sanitização NO COMMIT, não a execução
    // no DOM — então neutralizamos o diálogo: stub do alert + dismiss de
    // qualquer diálogo remanescente. Determinístico, sem mascarar regressão.
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.addInitScript(() => { (window as any).alert = () => {}; });
    await page.goto(BASE_URL);
    await page.waitForFunction(
      () => Boolean((window as any).__editor?.registry),
      null, { timeout: 5000 });
  });

  test('Tabs: editar painel inline preserva img/botão (sem perda de dados)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({
        type: 'root', children: [{
          id: 'tabs1', type: 'tabs', classes: [], attrs: {}, children: [],
          props: { items: [
            { title: 'A', content: '<p>Texto</p><img src="https://placehold.co/60" alt="i"><button class="btn btn-primary">B</button>' },
            { title: 'B', content: '<p>Pane B</p>' },
          ] },
        }],
      });
      const blockEl = ed.renderer.nodeElements.get('tabs1');
      const pane = blockEl.querySelector('[data-item-idx="0"]');
      const Tabs = ed.registry.get('tabs');
      const target = Tabs.getInlineEditTarget(blockEl, pane, ed.getNode('tabs1'));
      ed.startInlineEdit('tabs1', target, {});
      ed.commitInlineEdit();
      return ed.getNode('tabs1').props.items[0].content as string;
    });
    expect(result).toMatch(/<img/i);
    expect(result).toMatch(/<button/i);
  });

  test('Acordeão: editar item inline preserva img/botão', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({
        type: 'root', children: [{
          id: 'acc1', type: 'accordion', classes: ['accordion'], attrs: {}, children: [],
          props: { items: [
            { title: 'A', content: '<p>Texto</p><img src="https://placehold.co/60" alt="i"><button class="btn btn-primary">B</button>' },
            { title: 'B', content: '<p>Item B</p>' },
          ] },
        }],
      });
      const blockEl = ed.renderer.nodeElements.get('acc1');
      const body = blockEl.querySelector('[data-item-idx="0"]');
      const Acc = ed.registry.get('accordion');
      const target = Acc.getInlineEditTarget(blockEl, body, ed.getNode('acc1'));
      ed.startInlineEdit('acc1', target, {});
      ed.commitInlineEdit();
      return ed.getNode('acc1').props.items[0].content as string;
    });
    expect(result).toMatch(/<img/i);
    expect(result).toMatch(/<button/i);
  });

  test('Tabs: edição inline continua filtrando XSS (script/onerror)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({
        type: 'root', children: [{
          id: 'tabs2', type: 'tabs', classes: [], attrs: {}, children: [],
          props: { items: [{ title: 'A', content: '<p>ok</p>' }] },
        }],
      });
      const blockEl = ed.renderer.nodeElements.get('tabs2');
      const pane = blockEl.querySelector('[data-item-idx="0"]');
      const Tabs = ed.registry.get('tabs');
      const target = Tabs.getInlineEditTarget(blockEl, pane, ed.getNode('tabs2'));
      ed.startInlineEdit('tabs2', target, {});
      // Injeta conteúdo hostil no contenteditable e confirma.
      pane.innerHTML = '<p>texto</p><img src=x onerror="alert(1)"><script>alert(2)<\/script>';
      ed.commitInlineEdit();
      return ed.getNode('tabs2').props.items[0].content as string;
    });
    expect(result).not.toMatch(/<script/i);
    expect(result).not.toMatch(/onerror/i);
    // imagem benigna permanece (perfil amplo permite <img>, sem o handler).
    expect(result).toMatch(/<img/i);
  });

  test('Carrossel: botão flutuante reposiciona ao deslizar', async ({ page }) => {
    await page.evaluate(() => {
      const ed: any = (window as any).__editor;
      ed.loadJSON({
        type: 'root', children: [{
          id: 'car1', type: 'carousel', classes: ['carousel', 'slide'], attrs: {}, children: [],
          props: { controls: true, indicators: true, slides: [
            // Alturas diferentes p/ que trocar de slide mova o topo do item
            // ativo — só assim o reposicionamento do botão é observável.
            { src: '', alt: 's1', caption: '<h3>Slide 1</h3>', minHeight: '120px' },
            { src: '', alt: 's2', caption: '<h3>Slide 2</h3>', minHeight: '420px' },
          ] },
        }],
      });
      ed.selectBlock('car1');
    });

    const btn = page.locator('.editor-pane-edit-btn');
    await expect(btn).toBeVisible();

    // Desliza para o slide 2 via API do Bootstrap (dispara `slid.bs.carousel`,
    // que é o evento que o PaneEditButton passou a ouvir) e confirma que o
    // botão acompanha o item ativo.
    const aligned = await page.evaluate(async () => {
      const ed: any = (window as any).__editor;
      const blockEl = ed.renderer.nodeElements.get('car1');
      (window as any).bootstrap.Carousel.getOrCreateInstance(blockEl).next();
      await new Promise((r) => setTimeout(r, 800)); // espera slid.bs.carousel + raf
      const activeItem = blockEl.querySelector('.carousel-item.active');
      const activeIdx = activeItem?.dataset.itemIdx;
      const btnEl = document.querySelector('.editor-pane-edit-btn') as HTMLElement;
      const btnTop = btnEl.getBoundingClientRect().top;
      const paneTop = (activeItem as HTMLElement).getBoundingClientRect().top;
      return { activeIdx, delta: Math.abs(btnTop - (paneTop + 8)) };
    });
    expect(aligned.activeIdx).toBe('1');
    // O botão fica ~8px abaixo do topo do slide ativo (tolerância p/ animação).
    expect(aligned.delta).toBeLessThan(40);
  });
});
