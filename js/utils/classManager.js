/**
 * ClassManager — funções puras de manipulação da lista de classes Bootstrap.
 *
 * Responsividade: classes podem ser declaradas como TEMPLATES contendo `{bp}`
 * no lugar do segmento de breakpoint. Ex.:
 *   - 'text-{bp}-center' resolve para 'text-center' (default) ou 'text-md-center'
 *   - 'm-{bp}-3'         resolve para 'm-3'         ou 'm-md-3'
 *   - 'col-{bp}-6'       resolve para 'col-6'       ou 'col-md-6'
 *   - 'col-{bp}'         resolve para 'col'         ou 'col-md'
 *   - 'd-{bp}-flex'      resolve para 'd-flex'      ou 'd-md-flex'
 *
 * Com bp='' (xs/padrão), o segmento `{bp}` é removido junto com o hífen
 * adjacente. Com bp='md', vira o nome do breakpoint.
 */

export const RESPONSIVE_BREAKPOINTS = ['', 'sm', 'md', 'lg', 'xl', 'xxl'];

/** Resolve o template substituindo `{bp}` pelo breakpoint efetivo. */
export function resolveTemplate(template, bp = '') {
  if (typeof template !== 'string') return template;
  if (!template.includes('{bp}')) return template;
  if (!bp) {
    return template
      .replace(/-\{bp\}-/g, '-')
      .replace(/\{bp\}-/g, '')
      .replace(/-\{bp\}/g, '');
  }
  return template.replace(/\{bp\}/g, bp);
}

/** Substitui qualquer classe do grupo (resolvido no bp) pela `value`. */
export function setGroupValue(currentClasses, groupTpl, value, bp = '') {
  const resolved = groupTpl.map((t) => resolveTemplate(t, bp));
  const next = currentClasses.filter((c) => !resolved.includes(c));
  if (value) next.push(value);
  return next;
}

/** Encontra qual classe do grupo está aplicada no bp. Retorna a classe ou ''. */
export function findInGroup(currentClasses, groupTpl, bp = '') {
  const resolved = groupTpl.map((t) => resolveTemplate(t, bp));
  return currentClasses.find((c) => resolved.includes(c)) ?? '';
}

/** Adiciona/remove uma classe (resolvida no bp). */
export function toggleClass(currentClasses, classTpl, on, opts = {}, bp = '') {
  const cls = resolveTemplate(classTpl, bp);
  let next = currentClasses.filter((c) => c !== cls);
  if (on) {
    if (opts.removes) {
      const toRemove = opts.removes.map((t) => resolveTemplate(t, bp));
      next = next.filter((c) => !toRemove.includes(c));
    }
    next.push(cls);
  } else if (opts.addsWhenOff) {
    for (const t of opts.addsWhenOff) {
      const c = resolveTemplate(t, bp);
      if (!next.includes(c)) next.push(c);
    }
  }
  return next;
}

/** Verifica se uma classe está ativa no bp. */
export function isClassActive(currentClasses, classTpl, bp = '') {
  return currentClasses.includes(resolveTemplate(classTpl, bp));
}

/* ---------- Spacing (margin / padding) por lado ---------- */

const SPACING_SIDES = ['t', 'e', 'b', 's'];
const SPACING_VALUE_RE = /^(\d|auto)$/;

/**
 * Lê valores de espaçamento por lado (t/e/b/s) para a propriedade dada
 * ('m' = margin, 'p' = padding) no breakpoint dado.
 * Retorna { t, e, b, s } com strings ('0'..'5'|'auto'|'').
 */
export function readSpacing(classes, property, bp = '') {
  const result = { t: '', e: '', b: '', s: '' };
  for (const side of SPACING_SIDES) {
    const prefix = `${property}${side}`;
    const re = bp
      ? new RegExp(`^${prefix}-${bp}-(\\d|auto)$`)
      : new RegExp(`^${prefix}-(\\d|auto)$`);
    const found = classes.find((c) => re.test(c));
    if (found) result[side] = found.match(re)[1];
  }
  return result;
}

/**
 * Escreve valores de espaçamento, removendo classes anteriores do MESMO lado
 * e MESMO breakpoint, preservando outros breakpoints.
 */
export function writeSpacing(classes, property, value, bp = '') {
  let next = [...classes];
  for (const side of SPACING_SIDES) {
    const prefix = `${property}${side}`;
    const re = bp
      ? new RegExp(`^${prefix}-${bp}-(\\d|auto)$`)
      : new RegExp(`^${prefix}-(\\d|auto)$`);
    next = next.filter((c) => !re.test(c));
    const v = value?.[side];
    if (v != null && v !== '' && SPACING_VALUE_RE.test(String(v))) {
      next.push(bp ? `${prefix}-${bp}-${v}` : `${prefix}-${v}`);
    }
  }
  return next;
}
