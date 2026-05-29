import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { BLOCK_CONTENT_PROFILE } from './Paragraph.js';

/**
 * Accordion — itens colapsáveis. `props.items` é array de `{ title, content }`.
 *
 * Edição:
 *  - Painel lateral: gerenciamento visual via controle `items-list`.
 *  - Canvas: dblclick no botão do item edita o título; dblclick no corpo
 *    abre rich-text edit (HTML sanitizado por `BLOCK_CONTENT_PROFILE`, o mesmo
 *    do render — preserva img/botões/iframes inseridos via modal).
 *
 * Retrocompat: aceita formato legado em string ("Título | Conteúdo" por linha).
 */
export class Accordion extends Block {
  static type = 'accordion';
  static label = 'Acordeão';
  static icon = 'list-columns-reverse';
  static category = 'elements';
  static schema = {
    props: {
      items: [
        { title: 'Item 1', content: 'Conteúdo do primeiro item.' },
        { title: 'Item 2', content: 'Conteúdo do segundo item.' },
        { title: 'Item 3', content: 'Conteúdo do terceiro item.' },
      ],
      flush: false,
      alwaysOpen: false,
    },
    classes: ['accordion'],
    attrs: {},
  };
  static essentialClasses = ['accordion'];
  static allowedChildren = null;

  static render(node, ctx) {
    const accId = 'accordion-' + node.id.slice(0, 8);
    const items = Accordion._parseItems(node.props.items);
    const wrap = document.createElement('div');
    wrap.id = accId;

    items.forEach((it, i) => {
      const item = document.createElement('div');
      item.className = 'accordion-item';

      const h = document.createElement('h2');
      h.className = 'accordion-header';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accordion-button' + (i === 0 ? '' : ' collapsed');
      btn.setAttribute('data-bs-toggle', 'collapse');
      btn.setAttribute('data-bs-target', `#${accId}-c${i}`);
      btn.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
      btn.setAttribute('aria-controls', `${accId}-c${i}`);
      btn.dataset.itemTitleIdx = String(i);
      btn.textContent = it.title;
      h.appendChild(btn);

      const collapse = document.createElement('div');
      collapse.id = `${accId}-c${i}`;
      collapse.className = 'accordion-collapse collapse' + (i === 0 ? ' show' : '');
      if (!node.props.alwaysOpen) {
        collapse.setAttribute('data-bs-parent', '#' + accId);
      }

      const body = document.createElement('div');
      body.className = 'accordion-body';
      body.dataset.itemIdx = String(i);
      Accordion._writeContent(body, it.content, ctx);
      collapse.appendChild(body);

      item.appendChild(h);
      item.appendChild(collapse);
      wrap.appendChild(item);
    });
    return wrap;
  }

  static updateInPlace(node, element, prevProps, ctx) {
    for (const k of new Set([...Object.keys(prevProps), ...Object.keys(node.props)])) {
      if (k === 'items') continue;
      if (prevProps[k] !== node.props[k]) return false;
    }
    const prev = Accordion._parseItems(prevProps.items);
    const next = Accordion._parseItems(node.props.items);
    if (prev.length !== next.length) return false;

    for (let i = 0; i < next.length; i++) {
      const titleEl = element.querySelector(`[data-item-title-idx="${i}"]`);
      if (titleEl && prev[i].title !== next[i].title) {
        titleEl.textContent = next[i].title;
      }
      const bodyEl = element.querySelector(`[data-item-idx="${i}"]`);
      if (bodyEl && prev[i].content !== next[i].content
          && bodyEl.dataset.editing !== 'true') {
        Accordion._writeContent(bodyEl, next[i].content, ctx);
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
        ? Accordion._parseLine(i)
        : { title: i.title ?? '', content: i.content ?? '' }
      );
    }
    return String(raw ?? '').split('\n')
      .map(Accordion._parseLine)
      .filter((i) => i.title);
  }

  static _parseLine(line) {
    const parts = String(line).split('|').map((p) => p.trim());
    return { title: parts[0] || '', content: parts[1] || '' };
  }

  static getInlineEditTarget(blockEl, eventTarget, node) {
    const titleEl = eventTarget.closest('[data-item-title-idx]');
    if (titleEl && blockEl.contains(titleEl)) {
      const idx = Number(titleEl.dataset.itemTitleIdx);
      return {
        element: titleEl,
        read: (n) => Accordion._parseItems(n.props.items)[idx]?.title ?? '',
        write: (n, v) => Accordion._patchItem(n, idx, { title: v }),
      };
    }
    const bodyEl = eventTarget.closest('[data-item-idx]');
    if (bodyEl && blockEl.contains(bodyEl)) {
      const idx = Number(bodyEl.dataset.itemIdx);
      return {
        element: bodyEl,
        read: (n) => Accordion._parseItems(n.props.items)[idx]?.content ?? '',
        write: (n, v) => Accordion._patchItem(n, idx, { content: v }),
        html: true,
        multiline: true,
        // Mesmo perfil do armazenamento/render (`_writeContent`): preserva
        // img/button/iframe inseridos via modal. Usar o perfil só-inline aqui
        // apagaria esse conteúdo ao entrar/confirmar a edição.
        sanitizeProfile: BLOCK_CONTENT_PROFILE,
      };
    }
    return null;
  }

  static _patchItem(node, idx, patch) {
    const items = Accordion._parseItems(node.props.items);
    if (!items[idx]) return null;
    items[idx] = { ...items[idx], ...patch };
    return { props: { items } };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'items-list',
        bind: { kind: 'prop', key: 'items' },
        fields: [
          { key: 'title', label: 'Título', placeholder: 'Título do item' },
        ],
        contentField: 'content',
        contentInlineOpts: {
          html: true,
          multiline: true,
          sanitizeProfile: BLOCK_CONTENT_PROFILE,
        },
        modalEditor: true,
        defaultItem: { title: 'Novo item', content: '' },
        parse: Accordion._parseItems,
        addLabel: 'Adicionar item',
        itemLabel: (item, i) => `Item ${i + 1}` },

      { tab: 'content', type: 'toggle', label: 'Múltiplos abertos',
        toggleLabel: 'Permitir que mais de um item fique aberto',
        bind: { kind: 'prop', key: 'alwaysOpen' } },

      { tab: 'style', type: 'toggle', label: 'Sem bordas externas',
        toggleLabel: 'accordion-flush',
        bind: { kind: 'classToggle', class: 'accordion-flush' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
