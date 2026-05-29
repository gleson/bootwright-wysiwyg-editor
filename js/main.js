/**
 * main.js — entry STANDALONE (dev local).
 *
 * Em produção (Django), o template instancia o Editor diretamente —
 * este arquivo não é incluído. Veja README.md para o exemplo de integração.
 */
import { Editor } from './core/Editor.js';

const root = document.getElementById('editor-root');

if (!root) {
  console.error('[main] #editor-root não encontrado no DOM.');
} else {
  // Dev: `?collab=1` usa o servidor de referência local (npm run collab);
  // `?collab=ws://host:porta` aponta para outro. Sem o parâmetro, offline-only.
  const collabParam = new URLSearchParams(location.search).get('collab');
  const collabUrl = collabParam === '1' ? 'ws://localhost:8787'
    : (collabParam || null);

  const editor = new Editor({ rootElement: root, collabUrl }).init();

  // Expõe no window para inspeção via console no dev.
  window.__editor = editor;

  // Logs de fluxo durante o dev — facilita validar reatividade da Fase 1.
  editor.bus.on('state:changed',     (evt) => console.debug('[state]',     evt));
  editor.bus.on('selection:changed', (evt) => console.debug('[selection]', evt));
  editor.bus.on('history:changed',   (evt) => console.debug('[history]',   evt));
}
