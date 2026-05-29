---
name: editor-change-verifier
description: Use SEMPRE que o usuário do editor WYSIWYG terminar, consertar, corrigir, ajustar, refatorar, atualizar, mexer, registrar ou implementar QUALQUER parte do editor — blocos, dialogs, sanitizer, atalhos, BlockToolbar, HistoryManager, BlockRegistry, SlashMenu, ImageEditor, CollabManager, exporter, Carousel, Tabs, Accordion, perfis de sanitização, etc. Dispare em frases como "valida pra mim", "rode os testes", "confirma que tá ok", "verifica se quebrou algo", "da uma olhada se tá ok", "roda uma verificação", "testa", "smoke test", "terminei X", "consertei o bug de Y", "acabei de mexer em Z", "atualizei W", "refatorei", "registrei um bloco novo". Também invoque PROATIVAMENTE antes de declarar qualquer tarefa do editor como concluída, mesmo sem o usuário pedir explicitamente. Gera um teste Playwright em tests/ cobrindo só o que mudou nesta sessão, roda, e devolve relatório ✅/❌ pedindo correção em caso de falha.
metadata:
  type: workflow
---

# Editor change verifier

Verifica se as alterações feitas nesta sessão no editor WYSIWYG (`/home/master/Documentos/projetos/editor_wysiwyg_claude`) continuam funcionando do ponto de vista do usuário final, gerando e rodando testes Playwright direcionados ao que mudou.

A skill existe porque o editor é grande, tem muitos atalhos globais e re-renders agressivos, e regressões em um bloco frequentemente quebram outros. Um teste e2e focado no que acabou de mudar é a forma mais barata de pegar isso antes do usuário ver.

## Quando usar

Acione esta skill quando, **nesta mesma sessão**, você (Claude) tiver:
- Adicionado/alterado um bloco em `js/blocks/built-in/` ou registrado um novo via `BlockRegistry`.
- Mexido em qualquer arquivo de UI em `js/ui/` (dialogs, toolbar, sidebar, command palette, etc.).
- Alterado sanitizadores, perfis (`RICH_TEXT_*_PROFILE`, `BLOCK_CONTENT_PROFILE`), `HistoryManager`, `Renderer`, persistência ou `CollabManager`.
- Mexido em `build.mjs`, `package.json` scripts, ou regerado `dist/`.
- Corrigido um bug específico apontado pelo usuário no editor.

Não use para mudanças puramente em docs (`*.md`), assets estáticos sem efeito runtime, ou alterações fora do projeto do editor.

## Fluxo

Execute estes passos em ordem. Não pule etapas — se algum pré-requisito falhar, pare e reporte ao usuário, em vez de tentar contornar.

### 1. Levantar o conjunto de alterações desta sessão

Liste, a partir do seu próprio contexto de conversa (não use git — o projeto pode não ser repositório):

- Quais arquivos você editou/criou/removeu.
- Para cada um, em uma frase: o que mudou em termos de **comportamento observável** pelo usuário (não de implementação). Ex.: "Carousel agora aceita HTML rico nos slides via modal", "Atalho Ctrl+Shift+D abre o painel SEO", "Botão de exclusão da BlockToolbar deixou de propagar o evento".

Se você não tem certeza do que mudou (sessão muito longa, contexto comprimido), **pergunte ao usuário** em vez de adivinhar. Listar mudanças erradas gera testes inúteis.

### 2. Decidir o que testar

Para cada mudança comportamental, decida:

- **Cobrir com teste novo?** Sim, se for um caminho que um usuário do editor exercitaria (selecionar bloco, clicar em botão, ver resultado no canvas). Não, se for refactor interno sem efeito visível.
- **Estender teste existente?** Se já existir um teste em `tests/editor.spec.ts` na mesma área (mesmo bloco, mesmo dialog), prefira adicionar `test()` ao mesmo `describe`. Caso contrário, crie um arquivo novo `tests/<area>.spec.ts` (ex.: `tests/carousel-rich.spec.ts`).

Leia `tests/editor.spec.ts` antes de escrever para casar com o estilo existente: usa `@playwright/test`, `BASE_URL` via env (default `http://localhost:5173`), `window.__editor` exposto para introspecção.

### 3. Escrever os testes

Para cada teste, siga este formato:

```ts
test('descrição em pt-BR do comportamento observável', async ({ page }) => {
  // arrange: ações que levam o editor ao estado a verificar
  // act: a ação que está sendo validada
  // assert: assertion sobre o DOM, classes, atributos ou estado de window.__editor
});
```

Princípios:
- **Assertions de comportamento, não de implementação.** Prefira `await expect(page.locator('.editor-canvas .carousel-item.active')).toContainText('foo')` a checar nomes internos de variáveis JS.
- **Use `window.__editor` para arrange** (criar blocos via `editor.addBlock(...)`, carregar JSON via `editor.loadJSON(...)`) — é mais estável que simular cliques em toda a UI.
- **Sem `page.waitForTimeout` fixos.** Use `await expect(...).toBeVisible()` ou `page.waitForFunction(...)` — timeouts dormentes mascaram race conditions reais.
- **Um `test()` por comportamento.** Não empilhe três validações independentes num teste só, fica difícil saber o que quebrou.

Se a mudança envolveu sanitização, inclua pelo menos um teste com input "hostil" (ex.: `<script>` ou atributo `onerror`) para confirmar que continua sendo filtrado.

### 4. Garantir que o dev server está de pé

O teste precisa do bundle servido em `http://localhost:5173` (ou na URL definida em `BASE_URL`). Antes de rodar:

```bash
# checar se já há servidor respondendo
curl -sf http://localhost:5173 > /dev/null && echo "up" || echo "down"
```

Se estiver `down`, suba — o jeito padrão deste projeto é `python3 -m http.server 5173` na raiz do editor (o spec usa 5173, o TEST_CHECKLIST usa 8000; **use 5173** para casar com o default do spec). Suba em background via `run_in_background`. Depois espere por uma resposta 200 antes de rodar os testes.

Se o usuário já tem outro servidor numa porta diferente, respeite e exporte `BASE_URL` correspondente ao rodar o Playwright.

### 5. Rodar os testes

Rode apenas os arquivos relacionados ao que mudou (não a suíte inteira — feedback mais rápido):

```bash
cd /home/master/Documentos/projetos/editor_wysiwyg_claude
npx playwright test tests/<arquivo>.spec.ts --reporter=line
```

Se Playwright não estiver instalado (`npx playwright` falhar), pare e peça ao usuário para rodar `npm install -D @playwright/test && npx playwright install chromium` — não tente fazer isso silenciosamente, é instalação pesada.

### 6. Reportar

Devolva ao Claude (ou seja, escreva na resposta da conversa) um relatório com **exatamente** esta estrutura:

```
## Verificação do editor — <area mudada>

**Mudanças cobertas:**
- <arquivo>: <comportamento>
- ...

**Testes:** <arquivo .spec.ts> (<N> testes, <P> passaram, <F> falharam)

**Resultado:** ✅ OK | ❌ Falhas

[Se OK]
Tudo funcionando. Sem ação necessária.

[Se Falhas]
**Falhas:**
1. <nome do test()>
   - Esperado: <o que o teste esperava>
   - Obtido: <o que aconteceu>
   - Provável causa: <hipótese curta apontando o arquivo/linha suspeita das mudanças listadas>

**Solicitação:** Corrija as falhas acima e rode novamente esta skill para revalidar. Não declare a tarefa concluída enquanto este relatório não fechar com ✅ OK.
```

Use ✅/❌ porque o usuário lê visualmente — não troque por outras marcações.

Não invente "provável causa" se não tiver pista real — escreva "Causa não óbvia, investigar" em vez de chutar. Chute errado faz o Claude editar arquivo errado.

### 7. Em caso de falha persistente

Se na segunda execução o mesmo teste continuar falhando depois de uma tentativa de correção, **não rode uma terceira vez automaticamente**. Pare, reporte o histórico das duas tentativas e devolva o controle ao usuário — pode ser que o teste esteja errado, não o código.

## Anti-padrões

- Não rode `npm run build` "por garantia" antes de testar — o servidor estático serve `js/` direto via ESM em dev, o build só importa para produção.
- Não gere screenshots a menos que o teste seja explicitamente visual (alinhamento, layout) — encarece o report e raramente ajuda no diagnóstico.
- Não delete testes existentes "porque parecem obsoletos". Se um teste antigo passa a falhar por causa de uma mudança intencional de comportamento, **atualize-o** explicitando o motivo no commit/PR, não apague.
- Não use `test.skip()` para esconder uma falha sem explicação. Skip só com comentário citando o motivo e quem deve desbloquear.
