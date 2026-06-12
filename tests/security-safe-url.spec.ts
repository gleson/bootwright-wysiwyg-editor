import { test, expect } from '@playwright/test';

/**
 * Regressão de segurança — saneamento de URL/CSS fora do pipeline DOMPurify.
 * Cobre js/utils/url.js + sua aplicação em Button, Card, Image, Video, Audio,
 * Renderer (style cru) e exportHTML.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

test.describe('Segurança — safeUrl / safeCss', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor), null, { timeout: 5000 });
  });

  test('href javascript: no Botão é neutralizado no canvas', async ({ page }) => {
    const href = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'button', { text: 'X', href: 'javascript:alert(1)' });
      const a = ed.root.querySelector(`[data-block-id="${id}"]`);
      return a.getAttribute('href');
    });
    expect(href).not.toMatch(/javascript:/i);
    expect(href).toBe('#');
  });

  test('href javascript: no Botão NÃO sobrevive ao exportHTML', async ({ page }) => {
    const html = await page.evaluate(() => {
      const ed = (window as any).__editor;
      ed.addBlock(ed.rootId, 'button', { text: 'X', href: 'javascript:alert(1)' });
      return ed.exportHTML();
    });
    expect(html).not.toMatch(/javascript:/i);
  });

  test('Botão com target=_blank recebe rel="noopener noreferrer"', async ({ page }) => {
    const rel = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'button', { text: 'X', href: 'https://ex.com', target: '_blank' });
      const a = ed.root.querySelector(`[data-block-id="${id}"]`);
      return a.getAttribute('rel');
    });
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  test('actionHref javascript: no Card é neutralizado', async ({ page }) => {
    const href = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'card', { actionText: 'Ir', actionHref: 'javascript:alert(1)' });
      const a = ed.root.querySelector(`[data-block-id="${id}"] .card-body a.btn`);
      return a?.getAttribute('href');
    });
    expect(href).not.toMatch(/javascript:/i);
    expect(href).toBe('#');
  });

  test('src javascript: na Imagem é neutralizado (fica vazio)', async ({ page }) => {
    const src = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'image', { src: 'javascript:alert(1)', alt: 'x' });
      const img = ed.root.querySelector(`[data-block-id="${id}"]`);
      // o próprio elemento é o <img> (Image.render) — pega o atributo bruto
      return (img.tagName === 'IMG' ? img : img.querySelector('img'))?.getAttribute('src') ?? '';
    });
    expect(src).not.toMatch(/javascript:/i);
  });

  test('data:image é preservado como src de Imagem legítima', async ({ page }) => {
    const src = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const data = 'data:image/png;base64,iVBORw0KGgo=';
      const id = ed.addBlock(ed.rootId, 'image', { src: data, alt: 'x' });
      const img = ed.root.querySelector(`[data-block-id="${id}"]`);
      return (img.tagName === 'IMG' ? img : img.querySelector('img'))?.getAttribute('src') ?? '';
    });
    expect(src).toMatch(/^data:image\/png/);
  });

  test('expression() no style inline (attr) é removido pelo Renderer', async ({ page }) => {
    const style = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'paragraph', { text: 'oi' });
      ed.updateBlock(id, { attrs: { style: 'color:red; width:expression(alert(1))' } });
      const el = ed.root.querySelector(`[data-block-id="${id}"]`);
      return el.getAttribute('style') ?? '';
    });
    expect(style).not.toMatch(/expression\s*\(/i);
    // o pedaço legítimo permanece
    expect(style).toMatch(/color:\s*red/);
  });
});
