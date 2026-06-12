import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl,
  shadowControl } from '../common-controls.js';
import { safeUrl, applyLinkTarget } from '../../utils/url.js';

const VARIANTS = [
  'btn-primary','btn-secondary','btn-success','btn-danger',
  'btn-warning','btn-info','btn-light','btn-dark','btn-link',
  'btn-outline-primary','btn-outline-secondary','btn-outline-success',
  'btn-outline-danger','btn-outline-warning','btn-outline-info',
  'btn-outline-light','btn-outline-dark',
];

export class Button extends Block {
  static type = 'button';
  static label = 'Botão';
  static icon = 'app';
  static schema = {
    props: { text: 'Clique aqui', href: '#', target: '', icon: '', iconPosition: 'start' },
    classes: ['btn', 'btn-primary'],
    attrs: {},
  };
  static allowedChildren = null;
  static editableProp = 'text';
  /** Fast-path: só `text` atualiza in-place (no `.btn-label`); resto re-renderiza. */
  static fastUpdate = { text: { target: '.btn-label' } };

  /**
   * Renderiza como <a role="button"> para suportar href/target.
   * Bootstrap aceita classe .btn em qualquer elemento. O texto fica num
   * `<span class="btn-label">` para conviver com um ícone opcional sem que a
   * edição inline apague o ícone.
   */
  static render(node) {
    const a = document.createElement('a');
    a.href = safeUrl(node.props.href);
    applyLinkTarget(a, node.props.target);
    a.setAttribute('role', 'button');
    if (node.classes?.includes('disabled')) a.setAttribute('aria-disabled', 'true');

    const label = document.createElement('span');
    label.className = 'btn-label';
    label.textContent = node.props.text ?? '';

    const icon = node.props.icon
      ? Object.assign(document.createElement('i'),
          { className: `bi bi-${node.props.icon}` })
      : null;
    if (icon) icon.setAttribute('aria-hidden', 'true');

    if (icon && node.props.iconPosition === 'end') {
      a.append(label, document.createTextNode(' '), icon);
    } else if (icon) {
      a.append(icon, document.createTextNode(' '), label);
    } else {
      a.appendChild(label);
    }
    return a;
  }

  /** Edição inline mira o `.btn-label` para preservar o ícone. */
  static getInlineEditTarget(blockEl, eventTarget, node) {
    const label = blockEl.querySelector('.btn-label');
    if (!label) return null;
    return {
      element: label,
      read: (n) => n.props.text ?? '',
      write: (n, v) => ({ props: { text: v } }),
    };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Texto',
        bind: { kind: 'prop', key: 'text' } },
      { tab: 'content', type: 'text', label: 'URL (href)',
        bind: { kind: 'prop', key: 'href' } },
      { tab: 'content', type: 'select', label: 'Abrir em',
        options: [
          { value: '',       label: 'Mesma janela' },
          { value: '_blank', label: 'Nova aba' },
        ],
        bind: { kind: 'prop', key: 'target' } },

      { tab: 'content', type: 'action', label: 'Escolher ícone…',
        icon: 'grid-3x3-gap',
        onClick: (n, ctx) => {
          ctx.editor.ui.iconPicker?.pick((name) => {
            ctx.editor.updateBlock(n.id, { props: { icon: name } });
          });
        } },
      { tab: 'content', type: 'text', label: 'Ícone (nome) — vazio = sem ícone',
        help: 'Nome do Bootstrap Icon (ex.: arrow-right). Lista: icons.getbootstrap.com.',
        bind: { kind: 'prop', key: 'icon' } },
      { tab: 'content', type: 'select', label: 'Posição do ícone',
        options: [
          { value: 'start', label: 'Antes do texto' },
          { value: 'end',   label: 'Depois do texto' },
        ],
        bind: { kind: 'prop', key: 'iconPosition' } },

      { tab: 'style', type: 'select', label: 'Variante',
        options: VARIANTS.map((v) => ({ value: v, label: v.replace('btn-', '') })),
        bind: { kind: 'classGroup', group: VARIANTS } },
      { tab: 'style', type: 'select', label: 'Tamanho',
        options: [
          { value: '',       label: 'Médio (padrão)' },
          { value: 'btn-sm', label: 'Pequeno' },
          { value: 'btn-lg', label: 'Grande' },
        ],
        bind: { kind: 'classGroup', group: ['btn-sm','btn-lg'] } },
      { tab: 'style', type: 'toggle', label: 'Ocupa toda a largura',
        toggleLabel: 'w-100',
        bind: { kind: 'classToggle', class: 'w-100' } },
      { tab: 'style', type: 'toggle', label: 'Formato pílula',
        toggleLabel: 'rounded-pill (cantos totalmente arredondados)',
        bind: { kind: 'classToggle', class: 'rounded-pill' } },
      { tab: 'style', type: 'toggle', label: 'Desabilitado',
        toggleLabel: 'disabled (aparência inativa)',
        bind: { kind: 'classToggle', class: 'disabled' } },

      ...colorControl('text', 'Cor do texto'),
      ...colorControl('bg', 'Cor de fundo (sobrescreve a variante)'),

      ...shadowControl(),
      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
