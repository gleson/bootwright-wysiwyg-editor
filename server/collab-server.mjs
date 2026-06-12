/**
 * collab-server.mjs — servidor WebSocket de REFERÊNCIA para a edição
 * colaborativa do editor WYSIWYG. Zero dependências: implementa o handshake
 * e o enquadramento (framing) do protocolo WebSocket sobre o `http` nativo.
 *
 * NÃO é para produção — é um relay simples para desenvolvimento e para servir
 * de especificação executável do protocolo. Em produção, o time Django
 * implementa o mesmo protocolo (ex.: Django Channels). Veja `server/README.md`.
 *
 * Uso:
 *   node server/collab-server.mjs           # porta 8787
 *   PORT=9000 node server/collab-server.mjs # porta custom
 *
 * No editor:
 *   new Editor({ rootElement, collabUrl: 'ws://localhost:8787' }).init();
 *
 * Comportamento:
 *   - Relay puro de ops: repassa cada `op` a todos os outros clientes.
 *   - Mantém em cache o último `snapshot` recebido — serve quem entra depois
 *     (e responde a `sync-request`).
 *   - Rastreia presença e emite `peers` a cada entrada/saída.
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT) || 8787;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/**
 * Teto de tamanho por mensagem (8 MiB). Frames acima disso derrubam a conexão
 * em vez de alocar buffers arbitrários — um cliente hostil poderia anunciar
 * `len=2^63` e esgotar a memória do processo. Mesmo sendo servidor de dev,
 * uma rede compartilhada justifica o limite.
 */
const MAX_MESSAGE_SIZE = 8 * 1024 * 1024;

/** @type {Map<import('node:net').Socket, { id: string, name: string, color: string }>} */
const clients = new Map();
/** Último snapshot completo da árvore — cache para late joiners. */
let snapshot = null;

const server = http.createServer((req, res) => {
  // Healthcheck simples — útil em dev para conferir se o servidor está de pé.
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`collab-server ok — ${clients.size} cliente(s) conectado(s)\n`);
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    '\r\n'
  );

  const client = {
    id: crypto.randomUUID(),
    name: 'Anônimo',
    color: '#9ca3af',
  };
  clients.set(socket, client);
  console.log(`[collab] + ${client.id} (${clients.size} online)`);

  attachFrameReader(socket, (text) => handleMessage(socket, text));

  socket.on('close', () => {
    clients.delete(socket);
    console.log(`[collab] - ${client.id} (${clients.size} online)`);
    broadcastPeers();
  });
  socket.on('error', () => socket.destroy());
});

/* ---------- Protocolo (mensagens da aplicação) ---------- */

function handleMessage(socket, text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return; // mensagem inválida — ignora
  }
  const client = clients.get(socket);
  if (!client) return;

  switch (msg.t) {
    case 'hello':
      if (typeof msg.name === 'string') client.name = msg.name.slice(0, 40);
      if (typeof msg.color === 'string') client.color = msg.color.slice(0, 16);
      send(socket, { t: 'welcome', clientId: client.id, needSnapshot: snapshot === null });
      // Late joiner: já temos estado em cache → entrega na hora. Quem recebeu
      // needSnapshot=true é a fonte inicial e responde com o próprio snapshot.
      if (snapshot) send(socket, { t: 'snapshot', data: snapshot });
      broadcastPeers();
      break;

    case 'op':
      // Relay puro para os demais clientes.
      relay(socket, { t: 'op', op: msg.op, origin: client.id });
      break;

    case 'snapshot':
      // Atualiza o cache servido a late joiners. Não precisa repassar.
      if (msg.data) snapshot = msg.data;
      break;

    case 'sync-request':
      // Cliente divergiu — devolve o snapshot em cache, se houver.
      if (snapshot) send(socket, { t: 'snapshot', data: snapshot });
      break;

    default:
      // tipos desconhecidos: ignora (compatibilidade futura)
      break;
  }
}

function broadcastPeers() {
  const peers = [...clients.values()].map((c) => ({
    id: c.id, name: c.name, color: c.color,
  }));
  for (const socket of clients.keys()) {
    send(socket, { t: 'peers', peers });
  }
}

/** Envia para todos MENOS o remetente. */
function relay(from, obj) {
  for (const socket of clients.keys()) {
    if (socket !== from) send(socket, obj);
  }
}

function send(socket, obj) {
  try {
    socket.write(encodeFrame(JSON.stringify(obj)));
  } catch {
    /* socket caindo — o evento 'close' limpa */
  }
}

/* ---------- Enquadramento WebSocket (RFC 6455) ---------- */

/**
 * Lê frames de `socket` e chama `onText(string)` para cada mensagem de texto
 * completa. Trata ping (responde pong), close e fragmentação básica.
 */
function attachFrameReader(socket, onText) {
  let buffer = Buffer.alloc(0);
  let fragments = [];        // pedaços de uma mensagem de texto fragmentada
  let fragmentOpcode = null;

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      if (buffer.length < 2) return;

      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let len = buffer[1] & 0x7f;
      let offset = 2;

      if (len === 126) {
        if (buffer.length < offset + 2) return;
        len = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (len === 127) {
        if (buffer.length < offset + 8) return;
        len = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      // RFC 6455: todo frame vindo do cliente DEVE vir mascarado. E nenhum
      // frame (nem a soma dos fragmentos) pode passar do teto — caso contrário
      // derrubamos a conexão antes de alocar.
      if (!masked || len > MAX_MESSAGE_SIZE) {
        socket.destroy();
        return;
      }

      let maskKey = null;
      if (masked) {
        if (buffer.length < offset + 4) return;
        maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (buffer.length < offset + len) return; // frame incompleto — espera mais

      let payload = buffer.subarray(offset, offset + len);
      if (masked) {
        const unmasked = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) unmasked[i] = payload[i] ^ maskKey[i & 3];
        payload = unmasked;
      }
      buffer = buffer.subarray(offset + len);

      // 0x8 close | 0x9 ping | 0xA pong | 0x1 text | 0x2 binary | 0x0 continuation
      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode === 0x9) {
        socket.write(encodeFrame(payload, 0xa)); // pong com o mesmo payload
        continue;
      }
      if (opcode === 0xa) {
        continue; // pong recebido — ignora
      }

      if (opcode === 0x0) {
        // continuação de uma mensagem fragmentada
        fragments.push(payload);
      } else {
        // novo frame de dados (texto/binário)
        fragments = [payload];
        fragmentOpcode = opcode;
      }

      // Soma dos fragmentos também respeita o teto (mensagem fragmentada).
      if (fragments.reduce((n, f) => n + f.length, 0) > MAX_MESSAGE_SIZE) {
        socket.destroy();
        return;
      }

      if (fin) {
        const full = Buffer.concat(fragments);
        fragments = [];
        if (fragmentOpcode === 0x1) onText(full.toString('utf8'));
        fragmentOpcode = null;
      }
    }
  });
}

/** Monta um frame de servidor (sem máscara, FIN=1). `opcode` default: texto. */
function encodeFrame(data, opcode = 0x1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
  const len = payload.length;

  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/* ---------- Boot ---------- */

server.listen(PORT, () => {
  console.log(`[collab] servidor de referência ouvindo em ws://localhost:${PORT}`);
});
