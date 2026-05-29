import { Block } from '../Block.js';
import { spacingControls, advancedControls } from '../common-controls.js';

const VARIANTS = [
  'table-primary','table-secondary','table-success','table-danger',
  'table-warning','table-info','table-light','table-dark',
];

/**
 * Table — bloco com matriz 2D de células em `props.cells`.
 *
 * Estado:
 *   props.rows      número de linhas
 *   props.cols      número de colunas
 *   props.hasHeader true → primeira linha vira <thead>/<th>
 *   props.cells     string[][] (rows × cols), pode ter "buracos" tolerados pelo render
 *   props.merges    Array<{ r, c, rowspan, colspan }> — regiões mescladas. A
 *                   célula âncora fica em (r,c) com o span; as demais células
 *                   do retângulo são "cobertas" e não são renderizadas. O texto
 *                   das cobertas continua em `cells` (reaparece ao separar).
 *
 * Edição inline célula a célula via `getInlineEditTarget()`. O Canvas detecta
 * dblclick em `[data-cell="r,c"]` e o método retorna um target customizado
 * que escreve no slot correto da matriz (cópia profunda + mutação local).
 *
 * Seleção de range de células: o Canvas, com a tabela já selecionada, trata
 * clique/Shift+clique em `[data-cell]` como seleção de células
 * (`editor.tableCellSelection`). As ações "Mesclar"/"Separar" leem essa seleção.
 *
 * Resize de linhas/colunas: controles do tipo `range` usam `onChange` (no
 * schema do controle) que substitui a lógica padrão do bind, retornando um
 * patch que ajusta `rows`/`cols`, `cells` E `merges` ao mesmo tempo — evita
 * drift entre dimensões e dados.
 */
export class Table extends Block {
  static type = 'table';
  static label = 'Tabela';
  static icon = 'table';
  static schema = {
    props: {
      rows: 3,
      cols: 3,
      hasHeader: true,
      cells: [
        ['Coluna 1',   'Coluna 2',   'Coluna 3'],
        ['Célula 1.1', 'Célula 1.2', 'Célula 1.3'],
        ['Célula 2.1', 'Célula 2.2', 'Célula 2.3'],
      ],
      merges: [],
    },
    classes: ['table'],
    attrs: {},
  };
  static allowedChildren = null;

  /**
   * Constrói os índices de mescla: `covered` (células que não renderizam) e
   * `spanAt` (âncora → {rowspan, colspan}). Ignora merges 1×1 e fora da grade.
   */
  static _mergeIndex(node, rows, cols) {
    const merges = Array.isArray(node.props.merges) ? node.props.merges : [];
    const covered = new Set();
    const spanAt = new Map();
    for (const m of merges) {
      const r = m.r | 0, c = m.c | 0;
      const rs = Math.max(1, m.rowspan | 0);
      const cs = Math.max(1, m.colspan | 0);
      if (rs === 1 && cs === 1) continue;
      if (r < 0 || c < 0 || r + rs > rows || c + cs > cols) continue; // fora da grade
      spanAt.set(`${r},${c}`, { rowspan: rs, colspan: cs });
      for (let i = r; i < r + rs; i++) {
        for (let j = c; j < c + cs; j++) {
          if (i !== r || j !== c) covered.add(`${i},${j}`);
        }
      }
    }
    return { covered, spanAt };
  }

  static render(node) {
    const r = Math.max(1, Number(node.props.rows) || 3);
    const c = Math.max(1, Number(node.props.cols) || 3);
    const hasHeader = node.props.hasHeader === true;
    const cells = node.props.cells || [];
    const { covered, spanAt } = Table._mergeIndex(node, r, c);

    const table = document.createElement('table');

    const buildCell = (tag, i, j) => {
      if (covered.has(`${i},${j}`)) return null;
      const cell = document.createElement(tag);
      cell.textContent = cells[i]?.[j] ?? '';
      cell.dataset.cell = `${i},${j}`;
      const span = spanAt.get(`${i},${j}`);
      if (span) {
        if (span.colspan > 1) cell.colSpan = span.colspan;
        if (span.rowspan > 1) cell.rowSpan = span.rowspan;
      }
      return cell;
    };

    if (hasHeader) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      for (let j = 0; j < c; j++) {
        const th = buildCell('th', 0, j);
        if (th) { th.scope = 'col'; tr.appendChild(th); }
      }
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    const startRow = hasHeader ? 1 : 0;
    for (let i = startRow; i < r; i++) {
      const tr = document.createElement('tr');
      for (let j = 0; j < c; j++) {
        const td = buildCell('td', i, j);
        if (td) tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }

  /**
   * Fast-path do Renderer: se SÓ `props.cells` mudou, atualiza o texto das
   * células que diferem in-place. Qualquer outra mudança (rows/cols/header/
   * merges) volta ao re-render normal. Célula fora do DOM (coberta por merge)
   * aborta o fast-path por segurança.
   */
  static updateInPlace(node, element, prevProps) {
    for (const k of new Set([...Object.keys(prevProps), ...Object.keys(node.props)])) {
      if (k === 'cells') continue;
      if (prevProps[k] !== node.props[k]) return false;
    }
    const prev = prevProps.cells || [];
    const next = node.props.cells || [];
    const rows = Math.max(prev.length, next.length);
    for (let i = 0; i < rows; i++) {
      const prow = prev[i] || [];
      const nrow = next[i] || [];
      const cols = Math.max(prow.length, nrow.length);
      for (let j = 0; j < cols; j++) {
        if (prow[j] === nrow[j]) continue;
        const cell = element.querySelector(`[data-cell="${i},${j}"]`);
        if (!cell) return false; // célula não está no DOM → re-render é mais seguro
        cell.textContent = nrow[j] ?? '';
      }
    }
    return true;
  }

  /**
   * Devolve o alvo de edição inline para uma célula específica.
   * Retorna `null` se o dblclick não foi numa célula da própria tabela.
   */
  static getInlineEditTarget(blockEl, eventTarget, node) {
    const cell = eventTarget.closest('[data-cell]');
    if (!cell || !blockEl.contains(cell)) return null;
    const [r, c] = cell.dataset.cell.split(',').map(Number);
    return {
      element: cell,
      read: (n) => n.props.cells?.[r]?.[c] ?? '',
      write: (n, v) => {
        const cells = (n.props.cells ?? []).map((row) => [...row]);
        while (cells.length <= r) cells.push([]);
        while (cells[r].length <= c) cells[r].push('');
        cells[r][c] = v;
        return { props: { cells } };
      },
    };
  }

  static settings(node) {
    return [
      { tab: 'content', type: 'range', label: 'Linhas',
        min: 1, max: 12, step: 1,
        bind: { kind: 'prop', key: 'rows' },
        onChange: (value, n) => Table._resize(n,
          Math.max(1, Number(value) || 1),
          Math.max(1, Number(n.props.cols) || 3)) },
      { tab: 'content', type: 'range', label: 'Colunas',
        min: 1, max: 12, step: 1,
        bind: { kind: 'prop', key: 'cols' },
        onChange: (value, n) => Table._resize(n,
          Math.max(1, Number(n.props.rows) || 3),
          Math.max(1, Number(value) || 1)) },
      { tab: 'content', type: 'toggle', label: 'Cabeçalho',
        toggleLabel: 'Primeira linha como <thead>',
        bind: { kind: 'prop', key: 'hasHeader' } },

      { tab: 'content', type: 'action', label: '+ Linha',
        icon: 'plus-square',
        onClick: (n) => Table._resize(n,
          (Number(n.props.rows) || 3) + 1,
          Number(n.props.cols) || 3) },
      { tab: 'content', type: 'action', label: '− Linha',
        icon: 'dash-square',
        onClick: (n) => Table._resize(n,
          Math.max(1, (Number(n.props.rows) || 3) - 1),
          Number(n.props.cols) || 3) },
      { tab: 'content', type: 'action', label: '+ Coluna',
        icon: 'plus-square',
        onClick: (n) => Table._resize(n,
          Number(n.props.rows) || 3,
          (Number(n.props.cols) || 3) + 1) },
      { tab: 'content', type: 'action', label: '− Coluna',
        icon: 'dash-square',
        onClick: (n) => Table._resize(n,
          Number(n.props.rows) || 3,
          Math.max(1, (Number(n.props.cols) || 3) - 1)) },

      { tab: 'content', type: 'action', label: 'Mesclar células',
        icon: 'union',
        help: 'Selecione um intervalo de células no canvas (clique + Shift+clique) e mescle.',
        onClick: (n, ctx) => Table._mergeSelection(n, ctx?.editor) },
      { tab: 'content', type: 'action', label: 'Separar células',
        icon: 'subtract',
        help: 'Desfaz a mescla das células selecionadas.',
        onClick: (n, ctx) => Table._unmergeSelection(n, ctx?.editor) },

      { tab: 'style', type: 'toggle', label: 'Listrada',
        toggleLabel: 'table-striped (linhas alternadas)',
        bind: { kind: 'classToggle', class: 'table-striped' } },
      { tab: 'style', type: 'toggle', label: 'Hover',
        toggleLabel: 'table-hover (realça sob o cursor)',
        bind: { kind: 'classToggle', class: 'table-hover' } },
      { tab: 'style', type: 'toggle', label: 'Bordas',
        toggleLabel: 'table-bordered (borda em todas as células)',
        bind: { kind: 'classToggle', class: 'table-bordered' } },
      { tab: 'style', type: 'toggle', label: 'Compacta',
        toggleLabel: 'table-sm (padding reduzido)',
        bind: { kind: 'classToggle', class: 'table-sm' } },
      { tab: 'style', type: 'select', label: 'Variante',
        options: [
          { value: '', label: '— padrão —' },
          ...VARIANTS.map((v) => ({ value: v, label: v.replace('table-', '') })),
        ],
        bind: { kind: 'classGroup', group: VARIANTS } },

      ...spacingControls(),
      ...advancedControls(),
    ];
  }

  /** Redimensiona a matriz preservando dados na interseção e descartando
   *  merges que saiam da nova grade. */
  static _resize(node, rows, cols) {
    const old = node.props.cells || [];
    const cells = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) row.push(old[i]?.[j] ?? '');
      cells.push(row);
    }
    const merges = (Array.isArray(node.props.merges) ? node.props.merges : [])
      .filter((m) => (m.r | 0) + Math.max(1, m.rowspan | 0) <= rows
                  && (m.c | 0) + Math.max(1, m.colspan | 0) <= cols);
    return { props: { rows, cols, cells, merges } };
  }

  /* ---------- Mesclar / separar ---------- */

  /** Lê e valida a seleção de células do editor para esta tabela. */
  static _readSelection(node, editor) {
    const sel = editor?.tableCellSelection;
    if (!sel || sel.tableId !== node.id) return null;
    return {
      rMin: Math.min(sel.anchor.r, sel.focus.r),
      rMax: Math.max(sel.anchor.r, sel.focus.r),
      cMin: Math.min(sel.anchor.c, sel.focus.c),
      cMax: Math.max(sel.anchor.c, sel.focus.c),
    };
  }

  static _mergeSelection(node, editor) {
    const rect = Table._readSelection(node, editor);
    if (!rect) {
      editor?.notify?.toast('Selecione células na tabela primeiro (clique + Shift+clique).', 'warning');
      return null;
    }
    const { rMin, rMax, cMin, cMax } = rect;
    if (rMin === rMax && cMin === cMax) {
      editor?.notify?.toast('Selecione 2 ou mais células para mesclar.', 'warning');
      return null;
    }
    // Não dá pra mesclar atravessando a fronteira <thead>/<tbody>.
    if (node.props.hasHeader === true && rMin === 0 && rMax > 0) {
      editor?.notify?.toast('Não é possível mesclar o cabeçalho com o corpo da tabela.', 'warning');
      return null;
    }
    // Remove merges que tocam o novo retângulo — depois adiciona o novo.
    const merges = (Array.isArray(node.props.merges) ? node.props.merges : [])
      .filter((m) => {
        const mr2 = (m.r | 0) + Math.max(1, m.rowspan | 0) - 1;
        const mc2 = (m.c | 0) + Math.max(1, m.colspan | 0) - 1;
        const intersects = !(mr2 < rMin || (m.r | 0) > rMax || mc2 < cMin || (m.c | 0) > cMax);
        return !intersects;
      });
    merges.push({ r: rMin, c: cMin, rowspan: rMax - rMin + 1, colspan: cMax - cMin + 1 });
    if (editor) editor.tableCellSelection = null;
    return { props: { merges } };
  }

  static _unmergeSelection(node, editor) {
    const rect = Table._readSelection(node, editor);
    if (!rect) {
      editor?.notify?.toast('Selecione a célula mesclada para separar.', 'warning');
      return null;
    }
    const { rMin, rMax, cMin, cMax } = rect;
    const all = Array.isArray(node.props.merges) ? node.props.merges : [];
    const merges = all.filter((m) => {
      const mr2 = (m.r | 0) + Math.max(1, m.rowspan | 0) - 1;
      const mc2 = (m.c | 0) + Math.max(1, m.colspan | 0) - 1;
      const intersects = !(mr2 < rMin || (m.r | 0) > rMax || mc2 < cMin || (m.c | 0) > cMax);
      return !intersects;
    });
    if (merges.length === all.length) {
      editor?.notify?.toast('Nenhuma célula mesclada na seleção.', 'info');
      return null;
    }
    if (editor) editor.tableCellSelection = null;
    return { props: { merges } };
  }
}
