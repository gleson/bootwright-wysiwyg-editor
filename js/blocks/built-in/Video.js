import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

/**
 * Detecta URLs de YouTube/Vimeo e devolve a URL "embed" correspondente.
 * Retorna `null` se a URL não for de um provider conhecido.
 */
function toEmbedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();

  // YouTube — youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID, /embed/ID
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([\w-]{6,})/i
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;

  // Vimeo — vimeo.com/ID, player.vimeo.com/video/ID
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;

  return null;
}

export class Video extends Block {
  static type = 'video';
  static label = 'Vídeo';
  static icon = 'film';
  static category = 'basic';
  static schema = {
    props: {
      src: '', poster: '',
      controls: true, loop: false, autoplay: false, muted: true, playsinline: true,
    },
    classes: ['w-100'],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const src = node.props.src ?? '';
    const embed = toEmbedUrl(src);

    if (embed) {
      // YouTube/Vimeo — wrapper com ratio 16:9 para iframe responsivo.
      const wrap = document.createElement('div');
      wrap.className = 'ratio ratio-16x9';
      const iframe = document.createElement('iframe');
      // Adiciona autoplay/loop/mute via query string quando aplicável.
      const params = new URLSearchParams();
      if (node.props.autoplay) params.set('autoplay', '1');
      if (node.props.loop)     params.set('loop', '1');
      if (node.props.muted)    params.set('mute', '1');
      const finalSrc = params.toString()
        ? `${embed}${embed.includes('?') ? '&' : '?'}${params}`
        : embed;
      iframe.src = finalSrc;
      iframe.title = 'Vídeo embutido';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.frameBorder = '0';
      wrap.appendChild(iframe);
      return wrap;
    }

    // Vídeo nativo (arquivo .mp4/.webm/etc.)
    const v = document.createElement('video');
    v.src = src;
    if (node.props.poster)   v.poster = node.props.poster;
    if (node.props.controls !== false) v.controls = true;
    if (node.props.loop)        v.loop = true;
    if (node.props.autoplay)    v.autoplay = true;
    if (node.props.muted)       v.muted = true;
    if (node.props.playsinline) v.setAttribute('playsinline', '');
    return v;
  }

  static settings(node) {
    const isEmbed = toEmbedUrl(node.props.src) !== null;
    const embedHelp = isEmbed
      ? 'URL detectada como YouTube/Vimeo — será renderizada como iframe (16:9 responsivo). Poster e Controles nativos são ignorados nesse modo.'
      : 'Cole uma URL de YouTube/Vimeo (será embutida via iframe) ou um arquivo .mp4/.webm (player nativo).';

    return [
      { tab: 'content', type: 'text', label: 'URL do vídeo',
        help: embedHelp,
        bind: { kind: 'prop', key: 'src' } },
      { tab: 'content', type: 'file', label: 'Upload vídeo', accept: 'video/*',
        bind: { kind: 'prop', key: 'src' } },
      { tab: 'content', type: 'text', label: 'Poster (URL da imagem)',
        bind: { kind: 'prop', key: 'poster' } },
      { tab: 'content', type: 'toggle', label: 'Controles',
        toggleLabel: 'Mostrar controles do player',
        bind: { kind: 'prop', key: 'controls' } },
      { tab: 'content', type: 'toggle', label: 'Loop',
        toggleLabel: 'Repetir continuamente',
        bind: { kind: 'prop', key: 'loop' } },
      { tab: 'content', type: 'toggle', label: 'Autoplay',
        toggleLabel: 'Iniciar automaticamente (exige `muted` na maioria dos browsers)',
        bind: { kind: 'prop', key: 'autoplay' } },
      { tab: 'content', type: 'toggle', label: 'Mudo',
        toggleLabel: 'Sem som',
        bind: { kind: 'prop', key: 'muted' } },
      { tab: 'content', type: 'toggle', label: 'Playsinline',
        toggleLabel: 'Não abrir em fullscreen no iOS',
        bind: { kind: 'prop', key: 'playsinline' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
