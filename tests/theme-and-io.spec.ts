import { test, expect } from '@playwright/test';

/**
 * Cobre as features desta sessão:
 *  - Tema de cores Bootstrap (setThemeColor → :root vars + .btn recolorido + export).
 *  - Dropdown único Importar/Exportar na topbar.
 *  - Blocos novos Breadcrumb e Pagination renderizam.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

test.describe('Tema Bootstrap + Importar/Exportar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForFunction(() => Boolean((window as any).__editor), null, { timeout: 5000 });
    // Estado limpo de tema entre testes.
    await page.evaluate(() => (window as any).__editor.resetTheme());
  });

  test('setThemeColor injeta variável --bs-primary e recolore .btn-primary', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ed = (window as any).__editor;
      ed.setThemeColor('primary', '#ff0000');
      const id = ed.addBlock(ed.rootId, 'button', { text: 'X' });
      const a = ed.root.querySelector(`[data-block-id="${id}"]`);
      const rootVar = getComputedStyle(document.documentElement).getPropertyValue('--bs-primary').trim();
      const btnBg = getComputedStyle(a).getPropertyValue('--bs-btn-bg').trim();
      return { rootVar, btnBg };
    });
    expect(result.rootVar.toLowerCase()).toBe('#ff0000');
    expect(result.btnBg.toLowerCase()).toBe('#ff0000');
  });

  test('exportThemeCSS contém as regras e fica vazio sem overrides', async ({ page }) => {
    const out = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const empty = ed.exportThemeCSS();
      ed.setThemeColor('success', '#00aa55');
      const css = ed.exportThemeCSS();
      return { empty, css };
    });
    expect(out.empty).toBe('');
    expect(out.css).toContain('--bs-success:#00aa55');
    expect(out.css).toContain('.btn-success{');
  });

  test('resetTheme remove o style e os overrides', async ({ page }) => {
    const after = await page.evaluate(() => {
      const ed = (window as any).__editor;
      ed.setThemeColor('danger', '#990000');
      ed.resetTheme();
      return {
        theme: ed.getTheme(),
        styleText: document.getElementById('editor-theme-css')?.textContent ?? '',
      };
    });
    expect(Object.keys(after.theme).length).toBe(0);
    expect(after.styleText).toBe('');
  });

  test('topbar tem um único dropdown Importar/Exportar que abre o menu', async ({ page }) => {
    const toggle = page.locator('.editor-io-menu [data-bs-toggle="dropdown"]');
    await expect(toggle).toHaveCount(1);
    await toggle.click();
    const menu = page.locator('.editor-io-menu .dropdown-menu');
    await expect(menu).toBeVisible();
    // Importar + 3 exportações.
    await expect(menu.locator('.dropdown-item')).toHaveCount(4);
  });

  test('Breadcrumb renderiza itens com último ativo', async ({ page }) => {
    const html = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'breadcrumb', {});
      return ed.root.querySelector(`[data-block-id="${id}"]`).outerHTML;
    });
    expect(html).toContain('breadcrumb');
    expect(html).toContain('aria-current="page"');
  });

  test('Pagination renderiza páginas + setas com a atual ativa', async ({ page }) => {
    const info = await page.evaluate(() => {
      const ed = (window as any).__editor;
      const id = ed.addBlock(ed.rootId, 'pagination', { pages: 4, current: 2 });
      const nav = ed.root.querySelector(`[data-block-id="${id}"]`);
      return {
        items: nav.querySelectorAll('.page-item').length,
        active: nav.querySelector('.page-item.active .page-link')?.textContent,
      };
    });
    // 4 páginas + « + » = 6
    expect(info.items).toBe(6);
    expect(info.active).toBe('2');
  });
});
