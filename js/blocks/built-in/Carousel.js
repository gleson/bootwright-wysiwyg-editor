import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { BLOCK_CONTENT_PROFILE } from './Paragraph.js';

const DEFAULT_BG_SIZE = 'cover';
const DEFAULT_BG_POSITION = 'center center';
const DEFAULT_BG_REPEAT = 'no-repeat';
const DEFAULT_MIN_HEIGHT = '400px';
const DEFAULT_JUSTIFY = 'center';
const DEFAULT_ALIGN = 'center';

/** Opções de bg-size/position/repeat — compartilhadas entre painel lateral e o modal. */
export const SLIDE_BG_SIZE_OPTIONS = [
  { value: 'cover',     label: 'Cover (preenche cortando)' },
  { value: 'contain',   label: 'Contain (cabe sem cortar)' },
  { value: 'auto',      label: 'Auto (tamanho original)' },
  { value: '100% 100%', label: 'Esticada (100% × 100%)' },
];
export const SLIDE_BG_POSITION_OPTIONS = [
  { value: 'center center', label: 'Centro' },
  { value: 'top center',    label: 'Topo' },
  { value: 'bottom center', label: 'Base' },
  { value: 'center left',   label: 'Esquerda' },
  { value: 'center right',  label: 'Direita' },
  { value: 'top left',      label: 'Topo esquerda' },
  { value: 'top right',     label: 'Topo direita' },
  { value: 'bottom left',   label: 'Base esquerda' },
  { value: 'bottom right',  label: 'Base direita' },
];
export const SLIDE_BG_REPEAT_OPTIONS = [
  { value: 'no-repeat', label: 'Sem repetição' },
  { value: 'repeat',    label: 'Repetir (X e Y)' },
  { value: 'repeat-x',  label: 'Repetir horizontal' },
  { value: 'repeat-y',  label: 'Repetir vertical' },
  { value: 'space',     label: 'Espaçada' },
  { value: 'round',     label: 'Arredondada' },
];
export const SLIDE_CONTAINER_OPTIONS = [
  { value: '',                label: 'Sem container (largura total)' },
  { value: 'container',       label: 'Container (centrado, largura limitada)' },
  { value: 'container-fluid', label: 'Container-fluid (tela cheia com padding)' },
];

/**
 * Carousel — slides com imagem de fundo (background-image) + legenda HTML
 * opcional sobre a imagem.
 *
 * Schema (canônico): `props.slides` é array de
 *   `{ src, alt, bgSize, bgPosition, bgRepeat, minHeight, caption, container }`
 *
 * Render: a `<div class="carousel-item">` recebe `style="background-image:…;
 * background-size:…; background-position:…; background-repeat:…;
 * min-height:…"` e — opcionalmente — um `.container[-fluid]` interno com o
 * `.carousel-caption` (HTML rico sanitizado com `BLOCK_CONTENT_PROFILE`).
 *
 * Acessibilidade: quando há `src`, o item ganha `role="img"` + `aria-label`.
 *
 * Edição:
 *  - Painel lateral: TODOS os campos por slide (edição rápida sem abrir modal).
 *  - Canvas: botão flutuante PaneEditButton sobre o slide ativo abre o
 *    ContentEditor em "modo slide" — editor da legenda + barra de controles
 *    da imagem (URL/biblioteca + tamanho + posição + repetição + altura),
 *    com backdrop ao vivo no canvas do modal.
 *
 * Migração automática (legado) — `_normalizeSlide` aceita:
 *   1) `{ html, container }`        — fase intermediária (extrai 1ª <img>).
 *   2) `{ src, alt, caption, container }` — versão anterior (sem campos bg-*).
 *   3) `{ src, alt, caption (str) }`      — formato original.
 *   4) string "URL | alt | caption"       — formato muito antigo.
 * `_withDefaults` preenche todos os campos faltantes com valores padrão.
 */
export class Carousel extends Block {
  static type = 'carousel';
  static label = 'Carrossel';
  static icon = 'images';
  static category = 'elements';
  static SLIDE_DEFAULTS = Object.freeze({
    src: '', alt: '',
    bgSize: DEFAULT_BG_SIZE,
    bgPosition: DEFAULT_BG_POSITION,
    bgRepeat: DEFAULT_BG_REPEAT,
    minHeight: DEFAULT_MIN_HEIGHT,
    justifyContent: DEFAULT_JUSTIFY,
    alignItems: DEFAULT_ALIGN,
    caption: '', container: '',
  });
  static schema = {
    props: {
      slides: [
        { src: 'https://placehold.co/1200x400?text=Slide+1', alt: 'Slide 1', bgSize: DEFAULT_BG_SIZE, bgPosition: DEFAULT_BG_POSITION, bgRepeat: DEFAULT_BG_REPEAT, minHeight: DEFAULT_MIN_HEIGHT, caption: '', container: '' },
        { src: 'https://placehold.co/1200x400?text=Slide+2', alt: 'Slide 2', bgSize: DEFAULT_BG_SIZE, bgPosition: DEFAULT_BG_POSITION, bgRepeat: DEFAULT_BG_REPEAT, minHeight: DEFAULT_MIN_HEIGHT, caption: '', container: '' },
        { src: 'https://placehold.co/1200x400?text=Slide+3', alt: 'Slide 3', bgSize: DEFAULT_BG_SIZE, bgPosition: DEFAULT_BG_POSITION, bgRepeat: DEFAULT_BG_REPEAT, minHeight: DEFAULT_MIN_HEIGHT, caption: '', container: '' },
      ],
      controls: true,
      indicators: true,
      autoplay: false,
      interval: 5000,
    },
    classes: ['carousel', 'slide'],
    attrs: {},
  };
  static essentialClasses = ['carousel', 'slide'];
  static allowedChildren = null;

  static render(node, ctx) {
    const carouselId = 'carousel-' + node.id.slice(0, 8);
    const div = document.createElement('div');
    div.id = carouselId;
    if (node.props.autoplay) {
      div.setAttribute('data-bs-ride', 'carousel');
      div.setAttribute('data-bs-interval', String(node.props.interval || 5000));
    }

    const slides = Carousel._parseSlides(node.props.slides);

    if (node.props.indicators && slides.length > 0) {
      const ind = document.createElement('div');
      ind.className = 'carousel-indicators';
      slides.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-bs-target', '#' + carouselId);
        btn.setAttribute('data-bs-slide-to', String(i));
        if (i === 0) {
          btn.className = 'active';
          btn.setAttribute('aria-current', 'true');
        }
        btn.setAttribute('aria-label', `Slide ${i + 1}`);
        ind.appendChild(btn);
      });
      div.appendChild(ind);
    }

    const inner = document.createElement('div');
    inner.className = 'carousel-inner';
    slides.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'carousel-item' + (i === 0 ? ' active' : '');
      item.dataset.itemIdx = String(i);
      Carousel.applySlideBackground(item, s);

      let host = item;
      if (s.container) {
        const wrap = document.createElement('div');
        wrap.className = s.container;
        item.appendChild(wrap);
        host = wrap;
      }

      if (typeof s.caption === 'string' && s.caption.trim()) {
        const cap = document.createElement('div');
        // Mantém a classe padrão do Bootstrap pra herdar tipografia/cor mas
        // adiciona modificador que neutraliza o `position:absolute` e o
        // `d-none` — o slide é flex e a caption participa do layout.
        cap.className = 'carousel-caption carousel-slide-caption--flex';
        try {
          cap.innerHTML = ctx?.sanitizer
            ? ctx.sanitizer.html(s.caption, BLOCK_CONTENT_PROFILE)
            : s.caption;
        } catch {
          cap.textContent = s.caption;
        }
        host.appendChild(cap);
      }

      inner.appendChild(item);
    });
    div.appendChild(inner);

    if (node.props.controls && slides.length > 0) {
      div.appendChild(Carousel._control(carouselId, 'prev', 'Anterior'));
      div.appendChild(Carousel._control(carouselId, 'next', 'Próximo'));
    }
    return div;
  }

  /**
   * Aplica as propriedades visuais (imagem de fundo + altura mínima +
   * alinhamento flex dos itens internos) como `style` inline em qualquer
   * elemento. Reutilizado pelo ContentEditor para pintar o backdrop ao vivo
   * no canvas do modal.
   */
  static applySlideBackground(el, s) {
    const m = Carousel._withDefaults(s ?? {});
    if (m.src) {
      const safeUrl = String(m.src).replace(/"/g, '%22');
      el.style.backgroundImage = `url("${safeUrl}")`;
      el.style.backgroundSize = m.bgSize;
      el.style.backgroundPosition = m.bgPosition;
      el.style.backgroundRepeat = m.bgRepeat;
      el.setAttribute('role', 'img');
      if (m.alt) el.setAttribute('aria-label', m.alt);
      else el.removeAttribute('aria-label');
    } else {
      el.style.backgroundImage = '';
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
    el.style.minHeight = m.minHeight;
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = m.justifyContent;
    el.style.alignItems = m.alignItems;
  }

  static _control(carouselId, dir, label) {
    const btn = document.createElement('button');
    btn.className = `carousel-control-${dir}`;
    btn.type = 'button';
    btn.setAttribute('data-bs-target', '#' + carouselId);
    btn.setAttribute('data-bs-slide', dir);
    const icon = document.createElement('span');
    icon.className = `carousel-control-${dir}-icon`;
    icon.setAttribute('aria-hidden', 'true');
    const sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = label;
    btn.appendChild(icon);
    btn.appendChild(sr);
    return btn;
  }

  static _parseSlides(raw) {
    if (Array.isArray(raw)) {
      return raw.map((s) => typeof s === 'string'
        ? Carousel._legacyLineToSlide(s)
        : Carousel._normalizeSlide(s));
    }
    return String(raw ?? '').split('\n')
      .map((line) => Carousel._legacyLineToSlide(line))
      .filter((s) => s.src || s.caption);
  }

  /**
   * Migração one-shot. Marca como pendente qualquer slide que não tenha
   * todos os campos canônicos como strings (inclui bg-* novos).
   */
  static migrateNode(node) {
    const raw = node.props?.slides;
    if (!raw) return null;
    const isCanonical = Array.isArray(raw) && raw.every((s) => (
      s && typeof s === 'object'
      && typeof s.src === 'string' && typeof s.caption === 'string'
      && typeof s.bgSize === 'string' && typeof s.bgPosition === 'string'
      && typeof s.bgRepeat === 'string' && typeof s.minHeight === 'string'
      && typeof s.container === 'string'
      && !('html' in s)
    ));
    if (isCanonical) return null;
    return { props: { slides: Carousel._parseSlides(raw) } };
  }

  static _normalizeSlide(s) {
    if (!s || typeof s !== 'object') return Carousel._withDefaults({});
    // Fase intermediária: `{ html, container }` — extrai 1ª `<img>`.
    if (typeof s.html === 'string' && (!('src' in s) || s.src == null)) {
      const ex = Carousel._extractImgFromHtml(s.html);
      return Carousel._withDefaults({
        src: ex.src, alt: ex.alt, caption: ex.rest,
        container: s.container ?? '',
      });
    }
    return Carousel._withDefaults(s);
  }

  /** Preenche campos faltantes com defaults. */
  static _withDefaults(s) {
    return {
      src: typeof s.src === 'string' ? s.src : '',
      alt: typeof s.alt === 'string' ? s.alt : '',
      bgSize: typeof s.bgSize === 'string' && s.bgSize ? s.bgSize : DEFAULT_BG_SIZE,
      bgPosition: typeof s.bgPosition === 'string' && s.bgPosition ? s.bgPosition : DEFAULT_BG_POSITION,
      bgRepeat: typeof s.bgRepeat === 'string' && s.bgRepeat ? s.bgRepeat : DEFAULT_BG_REPEAT,
      minHeight: typeof s.minHeight === 'string' && s.minHeight ? s.minHeight : DEFAULT_MIN_HEIGHT,
      justifyContent: typeof s.justifyContent === 'string' && s.justifyContent ? s.justifyContent : DEFAULT_JUSTIFY,
      alignItems: typeof s.alignItems === 'string' && s.alignItems ? s.alignItems : DEFAULT_ALIGN,
      caption: typeof s.caption === 'string' ? s.caption : '',
      container: typeof s.container === 'string' ? s.container : '',
    };
  }

  static _legacyLineToSlide(line) {
    const parts = String(line).split('|').map((p) => p.trim());
    return Carousel._withDefaults({
      src: parts[0] || '', alt: parts[1] || '', caption: parts[2] || '',
    });
  }

  static _extractImgFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.querySelector('div');
    const img = root?.querySelector('img');
    if (img) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      img.remove();
      const rest = (root?.innerHTML || '').trim();
      return { src, alt, rest };
    }
    return { src: '', alt: '', rest: html };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'items-list',
        bind: { kind: 'prop', key: 'slides' },
        fields: [
          { key: 'src', type: 'text', label: 'URL da imagem de fundo',
            placeholder: 'https://…' },
          { key: 'alt', type: 'text', label: 'Texto alternativo (alt)',
            placeholder: 'Descrição para leitores de tela' },
          { key: 'bgSize', type: 'select', label: 'Tamanho da imagem',
            options: SLIDE_BG_SIZE_OPTIONS },
          { key: 'bgPosition', type: 'select', label: 'Posição da imagem',
            options: SLIDE_BG_POSITION_OPTIONS },
          { key: 'bgRepeat', type: 'select', label: 'Repetição',
            options: SLIDE_BG_REPEAT_OPTIONS },
          { key: 'minHeight', type: 'text', label: 'Altura mínima',
            placeholder: 'ex. 400px, 50vh' },
          { key: 'container', type: 'select', label: 'Largura do container',
            options: SLIDE_CONTAINER_OPTIONS },
          { key: 'caption', type: 'textarea', label: 'Legenda (HTML sobre a imagem)',
            placeholder: 'Use "Editor avançado…" ao lado para edição visual.', rows: 2 },
        ],
        modalEditor: true,
        contentField: 'caption',
        defaultItem: { ...Carousel.SLIDE_DEFAULTS },
        parse: Carousel._parseSlides,
        addLabel: 'Adicionar slide',
        itemLabel: (it, i) => `Slide ${i + 1}` },

      { tab: 'content', type: 'toggle', label: 'Setas',
        toggleLabel: 'Mostrar controles anterior/próximo',
        bind: { kind: 'prop', key: 'controls' } },
      { tab: 'content', type: 'toggle', label: 'Indicadores',
        toggleLabel: 'Mostrar pontos de navegação',
        bind: { kind: 'prop', key: 'indicators' } },
      { tab: 'content', type: 'toggle', label: 'Autoplay',
        toggleLabel: 'Avança automaticamente',
        bind: { kind: 'prop', key: 'autoplay' } },
      { tab: 'content', type: 'number', label: 'Intervalo (ms)',
        min: 1000, max: 20000, step: 500,
        bind: { kind: 'prop', key: 'interval' } },

      { tab: 'style', type: 'toggle', label: 'Fade',
        toggleLabel: 'Transição com fade em vez de slide',
        bind: { kind: 'classToggle', class: 'carousel-fade' } },
      { tab: 'style', type: 'toggle', label: 'Tema escuro (legendas)',
        toggleLabel: 'carousel-dark',
        bind: { kind: 'classToggle', class: 'carousel-dark' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
