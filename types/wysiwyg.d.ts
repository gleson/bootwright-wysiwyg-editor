/**
 * Tipos públicos do editor WYSIWYG.
 * O bundle distribuído (`dist/wysiwyg.esm.js`) acompanha este arquivo
 * (copiado em build para `dist/wysiwyg.d.ts`).
 */

export type BlockType = string;

/** Pares de classes Bootstrap / utilitárias aplicadas no nó renderizado. */
export type ClassList = string[];

/** Atributos HTML diretos do nó renderizado. */
export interface AttrMap {
  [key: string]: string | number | boolean | null | undefined;
}

/** Forma mínima de qualquer nó da árvore. */
export interface BlockNode<P = Record<string, unknown>> {
  id?: string;
  type: BlockType;
  props: P;
  classes: ClassList;
  attrs: AttrMap;
  children: BlockNode[];
}

/** Nó raiz da página — exporta metadados em `props` (seo, comments, ...). */
export interface RootNode extends BlockNode<RootProps> {
  type: 'root';
}

export interface RootProps {
  seo?: SeoMeta;
  comments?: Record<string, ReviewComment[]>;
  [key: string]: unknown;
}

export interface SeoMeta {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  robots?: string;
  lang?: string;
}

export interface ReviewComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  resolved: boolean;
}

/** Snapshot do auto-save em localStorage. */
export interface AutoSavePayload {
  editorVersion: string;
  schemaVersion: number;
  savedAt: string;
  data: RootNode;
}

/* ---------- Config ---------- */

export interface CsrfConfig {
  /** Nome do header HTTP. Padrão `X-CSRFToken`. */
  header?: string;
  /** Token literal — tem precedência sobre `cookie`. */
  token?: string;
  /** Nome do cookie de onde extrair o token (ex.: `XSRF-TOKEN`). */
  cookie?: string;
}

export interface TransportChannel {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  /** Apenas em `upload`: nome do campo multipart (default `file`). */
  field?: string;
  /** Resposta → array de assets (ou URL única). Ponto de extensão. */
  parser?: (data: unknown) => unknown;
}

export interface TransportConfig {
  upload?: TransportChannel;
  assets?: TransportChannel;
  save?:   TransportChannel;
}

export interface SanitizerConfig {
  allowSvg?: boolean;
  allowedTags?: string[];
  allowedAttrs?: string[];
  forbiddenTags?: string[];
  forbiddenAttrs?: string[];
  addHooks?: (purify: unknown) => void;
  logRemoved?: boolean;
}

export interface EditorConfig {
  rootElement: HTMLElement;

  /** Conteúdo inicial (JSON). Aceita null, "", "{}", string-encoded ou objeto. */
  initialJSON?: unknown;
  /** Alternativa unificada: { format: 'json'|'html'|'markdown', source }. */
  initialContent?: { format: 'json' | 'html' | 'markdown'; source: unknown };

  /** Form hidden a ser preenchido no save(). */
  targetField?: HTMLInputElement | null;

  /** Endpoints (alternativa a config.transport.* — convivem). */
  saveUrl?: string | null;
  uploadUrl?: string | null;
  assetsUrl?: string | null;
  transport?: TransportConfig;
  fetch?: typeof globalThis.fetch;

  /** CSRF — aceita objeto, string ou alias legado `csrfToken`. */
  csrf?: CsrfConfig | string;
  csrfToken?: string;

  /** Callback alternativo a saveUrl. */
  onSave?: (json: RootNode) => unknown;

  /** Auto-save em localStorage. */
  autoSave?: boolean;
  autoSaveKey?: string;
  autoSaveDebounce?: number;
  /** Se true (default), autoSave é desligado quando autoSaveKey ausente. */
  autoSaveStrict?: boolean;

  /** Sanitização. */
  sanitizer?: SanitizerConfig;
  allowSvg?: boolean;

  /** Não registra DjangoVar/Repeater/Form*. Equivalente a stack neutro. */
  disableDjangoBlocks?: boolean;
  /** Lista de tipos a NÃO registrar. */
  excludeBlocks?: BlockType[];

  /** Edição colaborativa (opt-in). */
  collabUrl?: string | null;
  collabName?: string | null;
}

/* ---------- Editor ---------- */

export class Editor {
  static readonly version: string;
  static readonly schemaVersion: number;
  static readonly instances: Map<string, Editor>;
  static registerLocale(code: string, strings: Record<string, string>): boolean;
  static setLocale(code: string): boolean;

  constructor(config: EditorConfig);
  init(): this;
  destroy(): void;

  /* ---------- Persistência ---------- */
  exportJSON(): RootNode;
  exportHTML(opts?: { minify?: boolean }): string;
  exportStandaloneHTML(opts?: {
    cdnBootstrap?: boolean;
    includeBootstrapJs?: boolean;
    minify?: boolean;
  }): string;
  exportSeoHead(): string;
  exportFontLinks(): string;
  loadJSON(data: unknown): void;
  save(): RootNode;

  /* ---------- Conteúdo ---------- */
  importContent(opts: {
    format: 'html' | 'markdown' | 'json';
    source: unknown;
    mode?: 'replace' | 'append';
  }): { count: number; ids: string[] };
  /** @deprecated Use `importContent({ format: 'html', source, mode })`. */
  importHTML(html: string, mode?: 'replace' | 'append'): { count: number; ids: string[] };

  /* ---------- Auto-save ---------- */
  hasAutoSave(): boolean;
  getAutoSaveInfo(): AutoSavePayload | null;
  restoreAutoSave(): boolean;
  clearAutoSave(): void;

  /* ---------- Estado / blocos ---------- */
  readonly rootId: string;
  getNode(id: string): BlockNode | null;
  getRoot(): RootNode;
  getParentOf(id: string): BlockNode | null;
  addBlock(parentId: string, type: BlockType, props?: object, index?: number): string | null;
  updateBlock(id: string, patch: Partial<BlockNode>, opts?: { coalesceKey?: string }): void;
  removeBlock(id: string): void;
  moveBlock(id: string, newParentId: string, index?: number): void;
  duplicateBlock(id: string): string | null;

  /* ---------- Seleção ---------- */
  selectBlock(id: string): void;
  deselectBlock(): void;
  getSelectedId(): string | null;
  getSelectedIds(): string[];

  /* ---------- Histórico ---------- */
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;

  /* ---------- SEO / comentários ---------- */
  getSeo(): SeoMeta;
  updateSeo(patch: Partial<SeoMeta>): SeoMeta;
  getComments(blockId: string): ReviewComment[];
  addComment(blockId: string, text: string): ReviewComment | null;

  /* ---------- Transport helpers ---------- */
  csrfHeaders(): Record<string, string>;
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  transportFor(channel: 'upload' | 'assets' | 'save'): {
    url: string | null;
    method: string;
    headers: Record<string, string>;
    field: string;
    parser: ((data: unknown) => unknown) | null;
  };
}

export const VERSION: string;
export const SCHEMA_VERSION: number;
