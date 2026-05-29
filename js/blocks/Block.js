/**
 * Block — classe base para todos os blocos.
 *
 * Subclasses declaram metadados via campos `static` e implementam `render`.
 * Não há estado de instância — Blocks são tratados como descritores estáticos
 * (singletons por tipo). A "instância" de um bloco é o nó na árvore JSON.
 *
 * Contrato:
 *   static type             — identificador único (ex.: "heading")
 *   static label            — rótulo amigável para a UI ("Título")
 *   static icon             — nome do ícone Bootstrap Icons (sem o "bi-")
 *   static schema           — { props, classes, attrs } padrão ao criar o bloco
 *   static allowedChildren  — null (folha) | "*" (qualquer) | string[] (lista)
 *
 *   static render(node, ctx) → HTMLElement
 *     ctx = { sanitizer }
 *
 *   static getChildrenContainer(rootEl) → HTMLElement
 *     Onde inserir filhos. Default: o próprio rootEl.
 *     Sobrescreva quando o bloco tem chrome em volta do conteúdo.
 *
 *   static settings(node) → ControlSchema[]
 *     Lista de controles para o painel de propriedades (Fase 4+).
 *
 *   static fastUpdate   — opcional
 *     Descritor declarativo do fast-path genérico do Renderer:
 *       { <prop>: { target: 'self' | <seletor CSS>, mode: 'text' | 'html' } }
 *     `target` 'self' (ou ausente) = o próprio elemento do bloco; um seletor
 *     CSS é resolvido via `element.querySelector`. `mode` 'html' sanitiza com
 *     `static richTextProfile` antes de injetar via innerHTML; default 'text'
 *     usa `textContent`. Declarando isto, o bloco ganha o fast-path de graça —
 *     a `updateInPlace` base trata sozinha updates em que SÓ essas props
 *     mudaram. Props fora do descritor (ou alvo ausente no DOM) caem no
 *     re-render normal.
 *
 *   static updateInPlace(node, element, prevProps, ctx)   — opcional
 *     Fast-path do Renderer. Chamado quando classes/attrs/filhos do nó NÃO
 *     mudaram. O bloco aplica a mudança "leve" (ex.: só texto) direto no
 *     `element` e retorna `true`; retornando `false`/undefined o Renderer faz
 *     o re-render normal do subtree. DEVE verificar via `prevProps` que só a(s)
 *     prop(s) que sabe tratar mudaram. ctx = { sanitizer, editor }.
 *     A implementação base cobre o caso declarativo via `static fastUpdate`;
 *     sobrescreva apenas para lógica específica (ex.: Table e suas células).
 *
 *   static decorateExport(node, element)   — opcional
 *     Chamado por Editor.exportHTML APÓS os filhos serem anexados. Permite
 *     ajustar o elemento exportado sem afetar o render do canvas. Ex.: o
 *     Repeater injeta nós de texto `{% for %}`/`{% endfor %}` em volta dos
 *     filhos. Não é chamado pelo Renderer (canvas).
 */
export class Block {
  static type = null;
  static label = null;
  static icon = 'square';
  static schema = { props: {}, classes: [], attrs: {} };
  static allowedChildren = null;
  /** Agrupa o bloco na sidebar: 'basic' | 'bootstrap' | 'elements'. */
  static category = 'basic';
  /** Classes que NÃO devem ser removidas em "Limpar formatações". null = usa schema.classes. */
  static essentialClasses = null;
  /**
   * Edição inline:
   *   - editableProp: prop alvo (string).
   *   - editableMultiline: Enter quebra linha em vez de comitar.
   *   - editableHtml: trata o valor como HTML (rich text). Comita via innerHTML
   *     sanitizado (allowlist de tags inline). Quando ativo, a RichTextToolbar
   *     flutuante aparece durante a edição.
   */
  static editableProp = null;
  static editableMultiline = false;
  static editableHtml = false;
  /** Descritor do fast-path genérico do Renderer (ver doc do contrato). */
  static fastUpdate = null;
  /** Profile DOMPurify usado pelo fast-path `mode: 'html'`. */
  static richTextProfile = undefined;

  static render(node, ctx) {
    throw new Error(`[Block] ${this.type ?? '?'}: render() não implementado.`);
  }

  /**
   * Fast-path genérico do Renderer dirigido por `static fastUpdate`. Aplica
   * mudanças "leves" (texto/HTML de uma prop) direto no DOM, sem recriar o
   * subtree. Retorna `true` se tratou a mudança; `false` faz o Renderer cair
   * no re-render normal — o que acontece quando alguma prop alterada não está
   * no descritor, ou seu elemento-alvo não existe (ex.: parte condicional).
   * Blocos com necessidades próprias (ex.: Table) sobrescrevem este método.
   */
  static updateInPlace(node, element, prevProps, ctx) {
    const map = this.fastUpdate;
    if (!map) return false;

    const changed = [];
    const keys = new Set([...Object.keys(prevProps), ...Object.keys(node.props)]);
    for (const k of keys) {
      if (prevProps[k] !== node.props[k]) changed.push(k);
    }
    // Toda prop alterada precisa ser tratável pelo descritor.
    if (changed.some((k) => !(k in map))) return false;

    for (const k of changed) {
      const desc = map[k];
      const targetEl = !desc.target || desc.target === 'self'
        ? element
        : element.querySelector(desc.target);
      if (!targetEl) return false; // alvo condicional ausente → re-render
      const value = node.props[k] ?? '';
      if (desc.mode === 'html') {
        try {
          targetEl.innerHTML = ctx?.sanitizer
            ? ctx.sanitizer.html(value, this.richTextProfile)
            : String(value);
        } catch {
          targetEl.textContent = value;
        }
      } else {
        targetEl.textContent = value;
      }
    }
    return true;
  }

  static getChildrenContainer(rootEl) {
    return rootEl;
  }

  static settings(node) {
    return [];
  }
}
