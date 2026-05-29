import { Block } from '../Block.js';
import { spacingControls, advancedControls, colorControl } from '../common-controls.js';

export class Card extends Block {
  static type = 'card';
  static label = 'Card';
  static icon = 'card-text';
  static category = 'bootstrap';
  static schema = {
    props: {
      title: 'Título do Card',
      subtitle: '',
      body: 'Texto explicativo do card.',
      image: '',
      imagePosition: 'top',         // 'top' | 'bottom' | 'none'
      actionText: 'Saiba mais',
      actionHref: '#',
      actionVariant: 'btn-primary',
    },
    classes: ['card'],
    attrs: {},
  };
  static essentialClasses = ['card'];
  static allowedChildren = null;

  static render(node) {
    const card = document.createElement('div');
    const renderImage = () => {
      if (!node.props.image) return null;
      const img = document.createElement('img');
      img.src = node.props.image;
      img.alt = '';
      img.className = node.props.imagePosition === 'bottom'
        ? 'card-img-bottom' : 'card-img-top';
      return img;
    };

    if (node.props.imagePosition === 'top') {
      const img = renderImage();
      if (img) card.appendChild(img);
    }

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
    card.appendChild(body);

    if (node.props.imagePosition === 'bottom') {
      const img = renderImage();
      if (img) card.appendChild(img);
    }
    return card;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'Título',
        bind: { kind: 'prop', key: 'title' } },
      { tab: 'content', type: 'text', label: 'Subtítulo',
        bind: { kind: 'prop', key: 'subtitle' } },
      { tab: 'content', type: 'textarea', label: 'Texto',
        bind: { kind: 'prop', key: 'body' } },
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

      ...colorControl('bg', 'Cor de fundo'),
      ...colorControl('text', 'Cor do texto'),

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
