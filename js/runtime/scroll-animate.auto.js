/**
 * scroll-animate.auto.js — auto-inicialização das animações on-scroll na
 * PÁGINA PUBLICADA (Django). Não é usado pelo editor.
 *
 * Inclua na página onde o HTML exportado é renderizado:
 *   <link rel="stylesheet" href="{% static 'wysiwyg/dist/scroll-animate.css' %}">
 *   <script src="{% static 'wysiwyg/dist/scroll-animate.js' %}" defer></script>
 *
 * Marca `<html>` com `wa-ready` imediatamente (minimiza FOUC) e roda o scan
 * quando o DOM estiver pronto.
 */
import { initScrollAnimations } from './scrollAnimate.js';
import { initParallax }         from './parallax.js';

// Marca o quanto antes — o CSS só esconde o conteúdo animável sob `.wa-ready`.
document.documentElement.classList.add('wa-ready');

function run() {
  initScrollAnimations(document);
  initParallax(document);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', run, { once: true });
} else {
  run();
}
