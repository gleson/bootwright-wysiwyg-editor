# Edição colaborativa — servidor e protocolo

Este diretório contém o **servidor WebSocket de referência** (`collab-server.mjs`)
e a especificação do protocolo de mensagens usado pela edição colaborativa do
editor (`js/core/CollabManager.js`).

O servidor de referência é **só para desenvolvimento** — zero dependências,
relay simples. Em produção, o backend (Django Channels, por exemplo) deve
implementar o mesmo protocolo.

## Rodando o servidor de referência

```bash
npm run collab            # ws://localhost:8787
PORT=9000 npm run collab  # porta custom
```

E no editor:

```js
new Editor({
  rootElement: document.getElementById('meu-editor'),
  collabUrl:   'ws://localhost:8787',
  collabName:  'Maria',   // opcional — default: nome aleatório
}).init();
```

Abra a mesma página em duas abas para ver a sincronização.

## Modelo de sincronização

**Broadcast de eventos + last-write-wins (LWW).** Cada mutação local na árvore
(`state:changed`) vira uma *op* enviada ao servidor, que a repassa aos demais
clientes. Não há OT/CRDT: edição simultânea do **mesmo nó** resolve pela última
op a chegar. É pragmático e suficiente para times pequenos editando partes
diferentes da página.

O `localStorage` (auto-save) **não é substituído** — continua como cache de
resiliência offline. Em reconexão, o cliente adota o snapshot do servidor.

## Protocolo de mensagens

Todas as mensagens são JSON com um campo `t` (tipo). Texto sobre WebSocket.

### Cliente → Servidor

| `t`            | Campos                                  | Quando |
|----------------|-----------------------------------------|--------|
| `hello`        | `name`, `color`                         | logo após conectar |
| `op`           | `op` (ver abaixo)                       | a cada mutação local |
| `snapshot`     | `data` (árvore raiz completa)           | debounced (~4s) — atualiza o cache do servidor |
| `sync-request` | —                                       | quando o cliente detecta divergência ao aplicar uma op |

### Servidor → Cliente

| `t`         | Campos                          | Quando |
|-------------|----------------------------------|--------|
| `welcome`   | `clientId`, `needSnapshot` (bool) | resposta ao `hello` |
| `snapshot`  | `data` (árvore raiz completa)     | a late joiners (logo após `welcome`, se há cache) / resposta a `sync-request` |
| `op`        | `op`, `origin` (clientId)         | relay de uma op de outro cliente |
| `peers`     | `peers: [{ id, name, color }]`    | a cada entrada/saída de cliente |

`needSnapshot: true` significa que o servidor ainda não tem snapshot em cache —
o cliente que recebeu isso é a fonte inicial e deve mandar um `snapshot` na hora.

### Formato das ops

A `op` é autossuficiente — carrega tudo que o cliente remoto precisa para
reproduzir a mutação. Mapeia 1:1 com os eventos `state:changed`:

```js
// insert — node é o subtree serializado (com os ids preservados)
{ kind: 'insert', parentId, index, node }

// remove
{ kind: 'remove', id }

// update — substitui props/classes/attrs do nó
{ kind: 'update', id, props, classes, attrs }

// replace — troca a árvore inteira (loadJSON / restore)
{ kind: 'replace', data }
```

Ao aplicar uma op remota, o `CollabManager` usa as primitivas do `State`
(`insertNode`/`detachNode`/`mutateNode`/`replace`) com um flag de supressão —
então a op **não** é reemitida (sem eco) e **não** entra no histórico de
undo/redo (o undo local não desfaz o trabalho de outro usuário).

## Implementando o servidor real (produção)

O servidor precisa, por *sala* (página sendo editada):

1. No `hello`: registrar o cliente, responder `welcome` (com `needSnapshot` =
   "ainda não tenho snapshot em cache"); se já houver snapshot em cache, enviar
   `snapshot` logo em seguida; e fazer broadcast de `peers`.
2. No `op`: repassar `{ t: 'op', op, origin }` a **todos os outros** clientes da
   sala. (O servidor de referência não persiste ops — só relay.)
3. No `snapshot`: guardar `data` como o snapshot em cache da sala. Em produção,
   este é um bom ponto para persistir no banco.
4. No `sync-request`: devolver `{ t: 'snapshot', data }` com o cache.
5. No disconnect: remover o cliente e fazer broadcast de `peers`.

O `collab-server.mjs` mantém **uma única sala global** — para múltiplas páginas,
particione por um identificador (ex.: query string `?room=<id>` na URL do WS).
