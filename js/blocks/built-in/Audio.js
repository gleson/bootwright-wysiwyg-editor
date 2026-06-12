import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';
import { safeUrl } from '../../utils/url.js';

export class Audio extends Block {
  static type = 'audio';
  static label = 'Áudio';
  static icon = 'music-note-beamed';
  static category = 'basic';
  static schema = {
    props: { src: '', controls: true, loop: false, autoplay: false, muted: false },
    classes: ['w-100'],
    attrs: {},
  };
  static allowedChildren = null;

  static render(node) {
    const audio = document.createElement('audio');
    audio.src = safeUrl(node.props.src, '');
    if (node.props.controls !== false) audio.controls = true;
    if (node.props.loop)     audio.loop = true;
    if (node.props.autoplay) audio.autoplay = true;
    if (node.props.muted)    audio.muted = true;
    return audio;
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'text', label: 'URL do áudio',
        bind: { kind: 'prop', key: 'src' } },
      { tab: 'content', type: 'file', label: 'Upload', accept: 'audio/*',
        help: 'Sem `uploadUrl` configurado, embute como data URL.',
        bind: { kind: 'prop', key: 'src' } },
      { tab: 'content', type: 'toggle', label: 'Controles',
        toggleLabel: 'Mostrar controles do player',
        bind: { kind: 'prop', key: 'controls' } },
      { tab: 'content', type: 'toggle', label: 'Loop',
        toggleLabel: 'Repetir continuamente',
        bind: { kind: 'prop', key: 'loop' } },
      { tab: 'content', type: 'toggle', label: 'Autoplay',
        toggleLabel: 'Iniciar automaticamente (geralmente exige `muted`)',
        bind: { kind: 'prop', key: 'autoplay' } },
      { tab: 'content', type: 'toggle', label: 'Mudo',
        toggleLabel: 'Iniciar sem som',
        bind: { kind: 'prop', key: 'muted' } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }
}
