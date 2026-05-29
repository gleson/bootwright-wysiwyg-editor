/**
 * CollabManager — edição colaborativa em tempo real via WebSocket.
 *
 * Ativado por `config.collabUrl`. Sem ele, o editor segue offline-only com
 * auto-save em localStorage. Com ele, o localStorage continua existindo como
 * cache de resiliência (reconexão / queda do servidor) — não é substituído.
 *
 * Estratégia: broadcast de eventos + last-write-wins (LWW).
 *   - Cada `state:changed` local vira uma "op" enviada ao servidor, que a
 *     repassa aos demais clientes (relay).
 *   - Ops remotas são aplicadas direto no State, com `_suppress` ligado para
 *     não reemitirem como ops de saída (evita eco infinito).
 *   - Ops remotas NÃO entram no HistoryManager (usam primitivas do State, não
 *     Commands): o undo local não desfaz o trabalho de outro usuário.
 *   - Periodicamente envia um snapshot completo da árvore — o servidor o
 *     guarda em cache para servir quem entrar depois (late joiners).
 *
 * Limitações conhecidas (aceitas para esta versão): edição simultânea do
 * MESMO nó resolve por LWW (a última op vence, sem merge). Em reconexão, o
 * cliente adota o snapshot do servidor — edições feitas offline podem ser
 * sobrescritas. Veja `server/README.md` para o protocolo de mensagens.
 */

const PEER_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

/** Nome amigável aleatório p/ identificar o usuário na sessão (sem login). */
function randomName() {
  const animals = ['Raposa', 'Coruja', 'Lontra', 'Tucano', 'Onça', 'Tatu', 'Arara', 'Lobo'];
  const a = animals[Math.floor(Math.random() * animals.length)];
  return `${a} ${Math.floor(100 + Math.random() * 900)}`;
}

export class CollabManager {
  constructor(editor) {
    this.editor = editor;
    this.url = editor.config.collabUrl;
    this.name = editor.config.collabName || randomName();
    this.color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];

    this.ws = null;
    this.clientId = null;
    this.status = 'idle';        // idle | connecting | connected | disconnected
    this.peers = [];             // [{ id, name, color }]

    this._suppress = false;      // true enquanto aplica op remota (não reemitir)
    this._manualClose = false;   // disconnect() explícito → não reconectar
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._snapshotTimer = null;
    this._offState = null;       // unsubscribe do bus
  }

  /* ---------- Ciclo de vida ---------- */

  connect() {
    if (this.ws || !this.url) return;
    this._manualClose = false;
    this._setStatus('connecting');

    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      console.error('[Collab] URL de WebSocket inválida:', err);
      this._setStatus('disconnected');
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this._reconnectAttempt = 0;
      this._send({ t: 'hello', name: this.name, color: this.color });
      this._setStatus('connected');
      // Escuta mutações locais só enquanto conectado.
      if (!this._offState) {
        this._offState = this.editor.bus.on('state:changed', (evt) => this._onLocalChange(evt));
        // Comentários moram em root.props (não viram ops). Para que apareçam
        // ao menos no snapshot servido a late joiners, agenda push aqui.
        this._offComments = this.editor.bus.on('comments:changed', () => {
          if (!this._suppress) this._scheduleSnapshot();
        });
      }
    });

    ws.addEventListener('message', (e) => this._onMessage(e.data));

    ws.addEventListener('close', () => {
      this.ws = null;
      this._teardownListener();
      if (this._manualClose) {
        this._setStatus('idle');
        return;
      }
      this._setStatus('disconnected');
      this._scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // 'close' vem logo em seguida e trata o reconnect; aqui só registra.
      console.warn('[Collab] erro de WebSocket.');
    });
  }

  disconnect() {
    this._manualClose = true;
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._snapshotTimer);
    this._teardownListener();
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this._setStatus('idle');
  }

  _teardownListener() {
    if (this._offState) { this._offState(); this._offState = null; }
    if (this._offComments) { this._offComments(); this._offComments = null; }
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    const delay = Math.min(1000 * 2 ** this._reconnectAttempt, 15000);
    this._reconnectAttempt++;
    this._reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /* ---------- Saída: mutações locais → ops ---------- */

  _onLocalChange(evt) {
    if (this._suppress) return;       // origem é uma op remota — não reemitir
    const op = this._buildOp(evt);
    if (op) this._send({ t: 'op', op });
    this._scheduleSnapshot();
  }

  /** Converte um evento `state:changed` numa op autossuficiente. */
  _buildOp(evt) {
    switch (evt.type) {
      case 'insert': {
        const node = this.editor.getNode(evt.id);
        if (!node) return null;
        return {
          kind: 'insert',
          parentId: evt.parentId,
          index: evt.index,
          node: JSON.parse(JSON.stringify(node)),
        };
      }
      case 'remove':
        return { kind: 'remove', id: evt.id };
      case 'update': {
        const node = this.editor.getNode(evt.id);
        if (!node) return null;
        return {
          kind: 'update',
          id: evt.id,
          props: { ...node.props },
          classes: [...node.classes],
          attrs: { ...node.attrs },
        };
      }
      case 'replace':
        return { kind: 'replace', data: this.editor.exportJSON() };
      default:
        return null;
    }
  }

  /** Envia um snapshot completo (debounced) p/ o servidor cachear. */
  _scheduleSnapshot() {
    clearTimeout(this._snapshotTimer);
    this._snapshotTimer = setTimeout(() => {
      this._send({ t: 'snapshot', data: this.editor.exportJSON() });
    }, 4000);
  }

  /* ---------- Entrada: mensagens do servidor ---------- */

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('[Collab] mensagem não-JSON ignorada.');
      return;
    }
    switch (msg.t) {
      case 'welcome':
        this.clientId = msg.clientId ?? null;
        // Servidor sem snapshot em cache → este cliente é a fonte inicial.
        if (msg.needSnapshot) {
          this._send({ t: 'snapshot', data: this.editor.exportJSON() });
        }
        break;
      case 'snapshot':
        if (msg.data) this._applyRemote(() => this.editor.loadJSON(msg.data));
        break;
      case 'op':
        this._applyOp(msg.op);
        break;
      case 'peers':
        this.peers = Array.isArray(msg.peers) ? msg.peers : [];
        this.editor.bus.emit('collab:peers', { peers: this.peers });
        break;
      default:
        console.warn('[Collab] tipo de mensagem desconhecido:', msg.t);
    }
  }

  /** Aplica uma op remota no State, sem reemitir e sem tocar no histórico. */
  _applyOp(op) {
    if (!op || !op.kind) return;
    const state = this.editor.state;
    try {
      this._applyRemote(() => {
        switch (op.kind) {
          case 'insert': {
            if (!op.node || state.getNode(op.node.id)) return; // já existe → ignora
            state.insertNode(state.hydrateNode(op.node), op.parentId, op.index);
            break;
          }
          case 'remove':
            if (state.getNode(op.id)) state.detachNode(op.id);
            break;
          case 'update':
            if (state.getNode(op.id)) {
              state.mutateNode(op.id, {
                props: op.props, classes: op.classes, attrs: op.attrs,
              });
            }
            break;
          case 'replace':
            if (op.data) state.replace(op.data);
            break;
          default:
            console.warn('[Collab] op desconhecida:', op.kind);
        }
      });
    } catch (err) {
      // Estado divergiu (ex.: op chegou fora de ordem). Pede ressincronização:
      // o servidor responde com o snapshot em cache.
      console.warn('[Collab] falha ao aplicar op, pedindo resync:', err);
      this._send({ t: 'sync-request' });
    }
  }

  /** Executa `fn` com `_suppress` ligado — mutações dentro dele não viram ops. */
  _applyRemote(fn) {
    const prev = this._suppress;
    this._suppress = true;
    try {
      fn();
    } finally {
      this._suppress = prev;
    }
  }

  /* ---------- Helpers ---------- */

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(obj));
      } catch (err) {
        console.warn('[Collab] envio falhou:', err);
      }
    }
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.editor.bus.emit('collab:status', { status, peers: this.peers });
  }
}
