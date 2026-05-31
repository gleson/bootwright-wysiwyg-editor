import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl,
  borderControls, shadowControl, sizingControls,
  themeControl, subtleColorControls, positionControls } from '../common-controls.js';

export class Card extends Block {
  static type = 'card';
  static label = 'Card';
  static icon = 'card-text';
  static category = 'bootstrap';
  static schema = {
    props: {
      header: '',
      title: 'Título do Card',
      subtitle: '',
      body: 'Texto explicativo do card.',
      footer: '',
      image: '',
      imagePosition: 'top',         // 'top' | 'bottom' | 'none'
      horizontal: false,            // imagem à esquerda + corpo à direita
      actionText: 'Saiba mais',
      actionHref: '#',
      actionVariant: 'btn-primary',
    },
    classes: ['card'],
    attrs: {},
  };
  static essentialClasses = ['card'];
  static allowedChildren = null;

  static _renderImage(node, position) {
    if (!node.props.image) return null;
    const img = document.createElement('img');
    img.src = node.props.image;
    img.alt = '';
    img.className = position === 'bottom' ? 'card-img-bottom' : 'card-img-top';
    return img;
  }

  static _renderHeader(node) {
    if (!node.props.header) return null;
    const h = document.createElement('div');
    h.className = 'card-header';
    h.textContent = node.props.header;
    return h;
  }

  static _renderFooter(node) {
    if (!node.props.footer) return null;
    const f = document.createElement('div');
    f.className = 'card-footer text-body-secondary';
    f.textContent = node.props.footer;
    return f;
  }

  static _renderBody(node) {
    const body = document.createElement('div');
    body.className = 'card-body';
    if (node.props.title) {
      const h = document.createElement('h5');
      h.className = 'card-title';
      h.textContent = node.props.title;
      body.appendChild(h);
    }
    if (node.props.subtitle) {
      const sub = document.createElement('h6');
      sub.className = 'card-subtitle mb-2 text-body-secondary';
      sub.textContent = node.props.subtitle;
      body.appendChild(sub);
    }
    if (node.props.body) {
      const p = document.createElement('p');
      p.className = 'card-text';
      p.textContent = node.props.body;
      body.appendChild(p);
    }
    if (node.props.actionText) {
      const a = document.createElement('a');
      a.href = node.props.actionHref || '#';
      a.className = `btn ${node.props.actionVariant || 'btn-primary'}`;
      a.textContent = node.props.actionText;
      body.appendChild(a);
    }
    return body;
  }

  static render(node) {
    const card = document.createElement('div');

    // Layout horizontal: imagem à esquerda (col-md-4) + conteúdo à direita.
    if (node.props.horizontal && node.props.image) {
      const row = document.createElement('div');
      row.className = 'row g-0';

      const imgCol = document.createElement('div');
      imgCol.className = 'col-md-4';
      const img = Card._renderImage(node, 'top');
      if (img) { img.classList.remove('card-img-top'); img.className += ' img-fluid rounded-start'; imgCol.appendChild(img); }

      const bodyCol = document.createElement('div');
      bodyCol.className = 'col-md-8';
      const header = Card._renderHeader(node);
      if (header) bodyCol.appendChild(header);
      bodyCol.appendChild(Card._renderBody(node));
      const footer = Card._renderFooter(node);
      if (footer) bodyCol.appendChild(footer);

      row.appendChild(imgCol);
      row.appendChild(bodyCol);
      card.appendChild(row);
      return card;
    }

    // Layout vertical padrão.
    if (node.props.imagePosition === 'top') {
      const img = Card._renderImage(node, 'top');
      if (img) card.appendChild(img);
    }
    const header = Card._renderHeader(node);
    if (header) card.appendChild(header);
    card.appendChild(Card._renderBody(node));
    if (node.props.imagePosition === 'bottom') {
      const img = Card._renderImage(node, 'bottom');
      if (img) card.appendChild(img);
    }
    const footer = Card._renderFooter(node);
    if (footer) card.appendChild(footer);
    return card;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Cabeçalho (opcional)',
        bind: { kind: 'prop', key: 'header' } },
      { tab: 'content', type: 'text', label: 'Título',
        bind: { kind: 'prop', key: 'title' } },
      { tab: 'content', type: 'text', label: 'Subtítulo',
        bind: { kind: 'prop', key: 'subtitle' } },
      { tab: 'content', type: 'textarea', label: 'Texto',
        bind: { kind: 'prop', key: 'body' } },
      { tab: 'content', type: 'text', label: 'Rodapé (opcional)',
        bind: { kind: 'prop', key: 'footer' } },
      { tab: 'content', type: 'text', label: 'URL da imagem',
        bind: { kind: 'prop', key: 'image' } },
      { tab: 'content', type: 'file', label: 'Upload da imagem', accept: 'image/*',
        bind: { kind: 'prop', key: 'image' } },
      { tab: 'content', type: 'select', label: 'Posição da imagem',
        options: [
          { value: 'top',    label: 'Topo' },
          { value: 'bottom', label: 'Base' },
          { value: 'none',   label: 'Sem imagem' },
        ],
        bind: { kind: 'prop', key: 'imagePosition' } },
      { tab: 'content', type: 'toggle', label: 'Layout',
        toggleLabel: 'Horizontal (imagem à esquerda)',
        help: 'Imagem à esquerda e conteúdo à direita (a partir do MD). Requer imagem.',
        bind: { kind: 'prop', key: 'horizontal' } },
      { tab: 'content', type: 'text', label: 'Texto do botão (vazio = sem botão)',
        bind: { kind: 'prop', key: 'actionText' } },
      { tab: 'content', type: 'text', label: 'URL do botão',
        bind: { kind: 'prop', key: 'actionHref' } },
      { tab: 'content', type: 'select', label: 'Variante do botão',
        options: [
          'btn-primary','btn-secondary','btn-success','btn-danger',
          'btn-warning','btn-info','btn-light','btn-dark',
          'btn-outline-primary','btn-outline-secondary','btn-outline-success',
          'btn-outline-danger',
        ].map((v) => ({ value: v, label: v.replace('btn-', '') })),
        bind: { kind: 'prop', key: 'actionVariant' } },

      { tab: 'style', type: 'select', label: 'Tema (text-bg-*)',
        help: 'Define fundo + cor de texto contrastante em uma classe só (Bootstrap 5.3).',
        options: [
          { value: '',                  label: '— nenhum —' },
          { value: 'text-bg-primary',   label: 'Primária' },
          { value: 'text-bg-secondary', label: 'Secundária' },
          { value: 'text-bg-success',   label: 'Sucesso' },
          { value: 'text-bg-danger',    label: 'Perigo' },
          { value: 'text-bg-warning',   label: 'Aviso' },
          { value: 'text-bg-info',      label: 'Info' },
          { value: 'text-bg-light',     label: 'Clara' },
          { value: 'text-bg-dark',      label: 'Escura' },
        ],
        bind: { kind: 'classGroup',
          group: ['text-bg-primary','text-bg-secondary','text-bg-success',
                  'text-bg-danger','text-bg-warning','text-bg-info',
                  'text-bg-light','text-bg-dark'] } },

      ...colorControl('bg', 'Cor de fundo'),
      ...colorControl('text', 'Cor do texto'),
      ...themeControl(),
      ...subtleColorControls(),

      ...borderControls(),
      ...shadowControl(),
      ...sizingControls(),
      ...spacingControls(),
      ...positionControls(),
      ...advancedControls(),
    ];
  }
}
