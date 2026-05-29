import { el, icon } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * CollabIndicator — chip de presença/status da edição colaborativa.
 *
 * Montado na Topbar só quando `config.collabUrl` está definido. Mostra o
 * estado da conexão (cor do ponto) e quantos colaboradores estão online;
 * o `title` lista os nomes. Reage a `collab:status` e `collab:peers` no bus.
 */
export class CollabIndicator {
  constructor(editor) {
    this.editor = editor;
    this.root = editor.root;
  }

  mount() {
    this.chip = el('span', {
      class: 'editor-collab',
      role: 'status',
      'aria-live': 'polite',
      'data-status': 'connecting',
    }, [
      el('span', { class: 'editor-collab__dot' }),
      icon('people-fill', 'editor-collab__icon'),
      el('span', { class: 'editor-collab__count' }, '0'),
    ]);

    const startGroup = this.root.querySelector('.editor-topbar__group--start');
    if (startGroup) startGroup.appendChild(this.chip);

    this.editor.bus.on('collab:status', ({ status }) => this._render(status));
    this.editor.bus.on('collab:peers',  () => this._render());

    this._render(this.editor.collab?.status ?? 'connecting');
  }

  /** Atualiza ponto, contagem e title. `status` omitido → mantém o atual. */
  _render(status) {
    if (!this.chip) return;
    const collab = this.editor.collab;
    const st = status ?? this.chip.dataset.status;
    this.chip.dataset.status = st;

    // Inclui o próprio usuário na contagem visível de colaboradores.
    const peers = collab?.peers ?? [];
    const total = peers.length || (st === 'connected' ? 1 : 0);
    this.chip.querySelector('.editor-collab__count').textContent = String(total);

    const statusLabel = t(`collab.status.${st}`);
    const names = peers.map((p) => p.name).filter(Boolean);
    const peopleLine = names.length
      ? t('collab.peers.list', { names: names.join(', ') })
      : t('collab.peers.alone');
    this.chip.title = `${statusLabel}\n${peopleLine}`;
    this.chip.setAttribute('aria-label', `${statusLabel}. ${peopleLine}`);
  }
}
