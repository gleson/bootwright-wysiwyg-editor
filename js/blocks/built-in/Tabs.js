import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { RICH_TEXT_FULL_PROFILE, BLOCK_CONTENT_PROFILE } from './Paragraph.js';

/**
 * Tabs — abas com conteúdo. `props.items` é array de `{ title, content }`.
 *
 * Edição:
 *  - Painel lateral: gerenciamento visual via controle `items-list` (adicionar,
 *    remover, reordenar, editar título de cada aba).
 *  - Canvas: dblclick em uma aba edita o título; dblclick no conteúdo da aba
 *    ativa entra em rich-text edit (HTML sanitizado por `RICH_TEXT_FULL_PROFILE`).
 *
 * Retrocompat: `props.items` ainda aceita string com `Título | Conteúdo` por
 * linha — `_parseItems` normaliza. Ao primeiro update via sidebar, vira array.
 */
export class Tabs extends Block {
  static type = 'tabs';
  static label = 'Abas';
  static icon = 'menu-button-wide';
  static category = 'elements';
  static schema = {
    props: {
      items: [
        { title: 'Aba 1', content: 'Conteúdo da primeira aba.' },
        { title: 'Aba 2', content: 'Conteúdo da segunda aba.' },
        { title: 'Aba 3', content: 'Conteúdo da terceira aba.' },
      ],
      style: 'tabs',  // 'tabs' | 'pills'
    },
    classes: [],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node, ctx) {
    const tabsId = 'tabs-' + node.id.slice(0, 8);
    const items = Tabs._parseItems(node.props.items);
    const wrap = document.createElement('div');

    const nav = document.createElement('ul');
    nav.className = `nav nav-${node.props.style || 'tabs'}`;
    nav.setAttribute('role', 'tablist');

    const content = document.createElement('div');
    content.className = 'tab-content pt-3';

    items.forEach((it, i) => {
      const paneId = `${tabsId}-${i}`;
      const li = document.createElement('li');
      li.className = 'nav-item';
      li.setAttribute('role', 'presentation');
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'nav-link' + (i === 0 ? ' active' : '');
      a.setAttribute('data-bs-toggle', 'tab');
      a.setAttribute('data-bs-target', '#' + paneId);
      a.setAttribute('role', 'tab');
      a.setAttribute('aria-controls', paneId);
      a.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      a.dataset.itemTitleIdx = String(i);
      a.textContent = it.title;
      li.appendChild(a);
      nav.appendChild(li);

      const pane = document.createElement('div');
      pane.id = paneId;
      pane.className = 'tab-pane fade' + (i === 0 ? ' show active' : '');
      pane.setAttribute('role', 'tabpanel');
      pane.dataset.itemIdx = String(i);
      Tabs._writeContent(pane, it.content, ctx);
      content.appendChild(pane);
    });

    wrap.appendChild(nav);
    wrap.appendChild(content);
    return wrap;
  }

  /**
   * Fast-path: se apenas `items` mudou e o array tem o mesmo length, atualiza
   * títulos e conteúdos in-place. Preserva foco/caret em painel sob edição
   * (não pisa em `[data-editing="true"]`). Em add/remove (length difere),
   * devolve false → re-render completo.
   */
  static updateInPlace(node, element, prevProps, ctx) {
    for (const k of new Set([...Object.keys(prevProps), ...Object.keys(node.props)])) {
      if (k === 'items') continue;
      if (prevProps[k] !== node.props[k]) return false;
    }
    const prev = Tabs._parseItems(prevProps.items);
    const next = Tabs._parseItems(node.props.items);
    if (prev.length !== next.length) return false;

    for (let i = 0; i < next.length; i++) {
      const titleEl = element.querySelector(`[data-item-title-idx="${i}"]`);
      if (titleEl && prev[i].title !== next[i].title) {
        titleEl.textContent = next[i].title;
      }
      const paneEl = element.querySelector(`[data-item-idx="${i}"]`);
      if (paneEl && prev[i].content !== next[i].content
          && paneEl.dataset.editing !== 'true') {
        Tabs._writeContent(paneEl, next[i].content, ctx);
      }
    }
    return true;
  }

  static _writeContent(el, content, ctx) {
    const raw = content ?? '';
    if (typeof raw === 'string' && /<[a-z][\s\S]*>/i.test(raw)) {
      try {
        // Usa o perfil amplo (imagens, botões, iframes) — necessário para que
        // o usuário possa inserir conteúdo livre via ContentEditor modal.
        el.innerHTML = ctx?.sanitizer
          ? ctx.sanitizer.html(raw, BLOCK_CONTENT_PROFILE)
          : raw;
      } catch {
        el.textContent = raw;
      }
    } else {
      el.textContent = raw;
    }
  }

  static _parseItems(raw) {
    if (Array.isArray(raw)) {
      return raw.map((i) => typeof i === 'string'
        ? Tabs._parseLine(i)
        : { title: i.title ?? '', content: i.content ?? '' }
      );
    }
    return String(raw ?? '').split('\n')
      .map(Tabs._parseLine)
      .filter((i) => i.title);
  }

  static _parseLine(line) {
    const parts = String(line).split('|').map((p) => p.trim());
    return { title: parts[0] || '', content: parts[1] || '' };
  }

  /**
   * Alvo de edição inline:
   *  - dblclick no `nav-link` → edita o título do item (texto puro)
   *  - dblclick no `tab-pane` → edita o conteúdo (rich-text HTML)
   */
  static getInlineEditTarget(blockEl, eventTarget, node) {
    const titleEl = eventTarget.closest('[data-item-title-idx]');
    if (titleEl && blockEl.contains(titleEl)) {
      const idx = Number(titleEl.dataset.itemTitleIdx);
      return {
        element: titleEl,
        read: (n) => Tabs._parseItems(n.props.items)[idx]?.title ?? '',
        write: (n, v) => Tabs._patchItem(n, idx, { title: v }),
      };
    }
    const paneEl = eventTarget.closest('[data-item-idx]');
    if (paneEl && blockEl.contains(paneEl)) {
      const idx = Number(paneEl.dataset.itemIdx);
      return {
        element: paneEl,
        read: (n) => Tabs._parseItems(n.props.items)[idx]?.content ?? '',
        write: (n, v) => Tabs._patchItem(n, idx, { content: v }),
        html: true,
        multiline: true,
        sanitizeProfile: RICH_TEXT_FULL_PROFILE,
      };
    }
    return null;
  }

  static _patchItem(node, idx, patch) {
    const items = Tabs._parseItems(node.props.items);
    if (!items[idx]) return null;
    items[idx] = { ...items[idx], ...patch };
    return { props: { items } };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'items-list',
        bind: { kind: 'prop', key: 'items' },
        fields: [
          { key: 'title', label: 'Título', placeholder: 'Título da aba' },
        ],
        contentField: 'content',
        contentInlineOpts: {
          html: true,
          multiline: true,
          sanitizeProfile: RICH_TEXT_FULL_PROFILE,
        },
        modalEditor: true,
        defaultItem: { title: 'Nova aba', content: '' },
        parse: Tabs._parseItems,
        addLabel: 'Adicionar aba',
        itemLabel: (item, i) => `Aba ${i + 1}` },

      { tab: 'style', type: 'select', label: 'Estilo',
        options: [
          { value: 'tabs',  label: 'Tabs (clássico)' },
          { value: 'pills', label: 'Pills (botões)' },
        ],
        bind: { kind: 'prop', key: 'style' } },
      { tab: 'style', type: 'toggle', label: 'Justificadas',
        toggleLabel: 'nav-fill (largura igual)',
        bind: { kind: 'classToggle', class: 'nav-fill' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
