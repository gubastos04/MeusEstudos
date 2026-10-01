# CLAUDE.md

Guia para trabalhar neste repositório. Leia antes de alterar qualquer coisa.

## O que é este produto

Plataforma de estudos práticos de programação, baseada na grade de ADS, para quem
estuda sozinho, no celular, em blocos de 10 a 20 minutos. O objetivo não é
"consumir cursos": é sair de "não sei programar" para "recebo uma demanda,
entendo, pesquiso, implemento, testo, versiono e explico o que fiz".

Prioridade de conteúdo: **prática > contexto > teoria**.

## Regras de produto que valem como requisito técnico

Estas não são preferências de estilo. Alterações que as violem devem ser
recusadas em review.

1. **Sem gamificação.** Nada de pontos, XP, níveis, medalhas, ranking, moedas,
   confete ou "Parabéns!". Métricas existem para informar, não para premiar.
2. **Sem streak.** A métrica de constância é *dias ativos nos últimos 7*. Não
   existe contador de dias consecutivos nem de dias perdidos. Um dia sem estudar
   é neutro e não aparece em vermelho.
3. **Vermelho só para erro real.** `danger` é reservado a erro técnico, risco,
   falha de validação. Nunca para falta de estudo, atraso, progresso baixo ou
   lista vazia.
4. **Interromper é legítimo.** Sair no meio salva o ponto de parada e o tempo.
   Nenhum texto culpa a pessoa por isso.
5. **Progresso não volta pra trás.** Reabrir conteúdo concluído não rebaixa o
   status; `completedAt` guarda a primeira conclusão.
6. **Um próximo passo.** O painel mostra UMA recomendação, nunca uma lista
   infinita. O modo "tenho X minutos" mostra no máximo quatro opções.
7. **Sem trocar de janela.** Conteúdo, editor, testes, glossário, documentação,
   registro de erro e IA acontecem dentro da plataforma.
8. **Tom de voz.** Português do Brasil, direto, calmo, frases curtas. Sem emoji
   na interface, sem entusiasmo artificial, sem infantilização.
9. **Honestidade sobre verificação.** Quando a checagem é por padrão de texto e
   não por execução, a interface diz isso. Nunca fingir que uma verificação
   estrutural prova que o código funciona.
10. **Nada inventado.** A plataforma não gera métrica de resultado nem texto de
    portfólio no lugar da pessoa.

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Estilo | Tailwind CSS 3 com design system próprio em CSS variables |
| Banco (dev) | SQLite |
| Banco (produção) | PostgreSQL (Neon, Supabase ou equivalente) |
| ORM | Prisma |
| Conteúdo | JSON versionado em `/content`, validado com Zod |
| IA | API da Anthropic, chamada por `fetch` no servidor |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`), carregado sob demanda |
| Testes | Vitest |

Dependências são poucas de propósito. Antes de adicionar uma, verifique se o
problema não se resolve com a biblioteca padrão ou com 30 linhas próprias.

## Comandos

```bash
npm run setup            # instala, gera o client, cria o banco, sincroniza conteúdo e semeia
npm run dev              # servidor de desenvolvimento
npm run build            # build de produção (roda prisma generate antes)
npm run typecheck        # tsc --noEmit
npm test                 # vitest (117 testes; cria prisma/test-vitest.db do zero)
npm run content:validate # valida /content sem tocar no banco (use em CI)
npm run content:sync     # espelha /content nas tabelas do banco
npm run db:push          # aplica o schema no banco de desenvolvimento (SQLite)
npm run db:provider postgresql   # troca o provider antes do build de produção
npm run db:studio        # inspeciona os dados
npm run db:provider postgresql   # troca o provider antes do deploy
```

## Estrutura

```
content/                  conteúdo educacional (fonte da verdade)
  semestre-1..4/*.json    módulos: itens, exercícios, avaliações
  demandas/*.json         demandas de empresa
  projetos/*.json         projetos evolutivos
  desafios/*.json         desafios
  glossario.json          termos
  trilhas.json            caminhos sugeridos no início rápido

prisma/schema.prisma      modelo de dados

scripts/
  validate-content.ts     validação de conteúdo (schema + regras de produto)
  sync-content.ts         espelha /content no banco
  db-provider.mjs         troca sqlite <-> postgresql

src/lib/                  regras, sem JSX
  env.ts                  configuração validada
  db.ts                   cliente Prisma
  crypto.ts               scrypt, AES-256-GCM, HMAC
  session.ts auth.ts      sessão e autenticação
  api.ts                  wrapper dos route handlers
  rate-limit.ts           limites persistidos
  content/schema.ts       schema Zod do conteúdo
  content/loader.ts       leitura e validação de /content
  progress.ts             progresso, atividade, eventos
  next-step.ts            recomendação e revisão
  avaliacoes.ts           versão pública (sem gabarito) e resumo
  runner/                 execução de exercícios
  ai/                     configuração, limites, cliente, prompts

src/components/           componentes; client apenas quando há estado
src/app/(app)/            telas autenticadas
src/app/api/              rotas de API
```

## Decisões técnicas

### Conteúdo em JSON, banco como espelho

`/content` é a fonte da verdade. `npm run content:sync` espelha metadados em
tabelas (`Module`, `Lesson`, `Exercise`, `Assessment`, `Question`, `Demand`,
`Project`, `Challenge`, `GlossaryTerm`) para permitir filtro, busca e relação
com dados de usuário. A aplicação nunca escreve nessas tabelas em runtime.

Conteúdo inválido **não derruba o app**: o loader isola o arquivo com problema,
registra em `issues` e carrega o resto.

Adicionar um módulo = adicionar um JSON + `npm run content:validate` +
`npm run content:sync`. Nada de CMS.

Isso vale em produção a cada deploy que mexe em `/content`. O texto da aula vem
dos arquivos, então ela aparece na tela mesmo sem sincronizar — mas
`ExerciseAttempt.exerciseId` tem chave estrangeira para `Exercise`, e a primeira
tentativa num exercício que não está no espelho falha. Deploy de código não
sincroniza banco.

### Sem enum e sem Json no Prisma

O mesmo `schema.prisma` roda em SQLite e PostgreSQL. Por isso todos os campos
com valores fixos são `String` (com o domínio no comentário) e listas/objetos
são JSON serializado em `String` (ver `src/lib/json.ts`).

### Um schema, dois bancos

O Prisma lê **somente** `DATABASE_URL`. O mesmo nome vale nos dois ambientes,
com valor diferente: SQLite no `.env` local, PostgreSQL nas variáveis do
provedor de deploy. Não existe variável separada para produção.

O `provider` do datasource não aceita `env()`, então ele é trocado por
comando. O repositório versiona `sqlite`, porque é o que faz `npm run dev` e os
117 testes funcionarem logo depois de um `git clone`. O build de produção roda
`npm run db:provider postgresql` antes do `next build`.

Ao trocar o provider à mão, rode `npx prisma generate` depois: o client gerado
é específico do banco.

**`npm run db:conferir` compara o provider do schema com o do client gerado e
falha se divergirem.** Essa divergência não dá erro por si: um client antigo
aceita a URL do banco para o qual foi gerado e grava no lugar errado em
silêncio. Foi assim que um `content:sync` destinado à produção escreveu no
SQLite local relatando sucesso. `deploy:preparar` termina com essa conferência.

**O fluxo de schema é `prisma db push`**, nos dois ambientes. É suficiente
enquanto não há dados de usuário que importem, e evita cerimônia sem retorno.

`prisma/migrations/0_inicial` existe como marco inicial, gerado do mesmo
schema e conferido contra o banco de produção (`migrate diff` vazio). Está
dormente de propósito: no dia em que existirem usuários de verdade, `db push`
passa a ser perigoso — ele pode remover coluna em silêncio — e aí o caminho é
registrar esse marco com `prisma migrate resolve --applied 0_inicial` e seguir
com migrations. Até lá, ele não atrapalha o `db push`.

### Autenticação própria

- Senha: `scrypt` (N=2^16) com salt por usuário, via `node:crypto`. Sem
  dependência nativa, o que mantém o deploy simples.
- Sessão: token opaco de 32 bytes em cookie `HttpOnly; Secure; SameSite=Lax`.
  O banco guarda apenas o SHA-256 do token.
- Login responde a mesma mensagem para email inexistente e senha errada, e
  executa um hash falso no caminho sem usuário para igualar o tempo de resposta.
- CSRF: cookie `SameSite=Lax` + verificação de `Origin` em toda requisição
  mutável (`sameOrigin` em `src/lib/api.ts`).

### Isolamento entre usuários

**O `userId` vem sempre da sessão.** Nenhuma rota aceita identificador de
usuário do cliente. Toda consulta a dado de usuário filtra por `userId`; em
recursos por id, use `findFirst({ where: { id, userId } })` ou
`updateMany/deleteMany({ where: { id, userId } })`.

Ao criar um recurso novo por usuário, escreva também o teste "usuário A não
acessa o recurso de B".

### Execução de código

Código de usuário **nunca** roda no servidor.

- JavaScript/TypeScript: Web Worker criado a partir de Blob, com timeout de 3s
  e `terminate()` — a única forma confiável de parar um laço infinito.
  Não há compilador embarcado: `stripTypes` remove as anotações e o que executa
  é JavaScript. Ele dá conta do que aparece em exercício pequeno, e o limite
  conhecido é interface com objeto aninhado — coberto por
  `tests/typescript-runner.test.ts`, que executa o resultado em vez de comparar
  texto.
- Python: Pyodide em Worker, baixado sob demanda com confirmação explícita
  (são megabytes; a pessoa pode estar em rede móvel). Falha de download degrada
  para verificação estrutural com mensagem clara.
- Demais linguagens: verificação estrutural (`src/lib/runner/structural.ts`),
  sempre rotulada como tal na interface.

Limite honesto: o Worker protege a experiência (travar, demorar), não é sandbox
de segurança — é o código da própria pessoa, no navegador dela.

### Avaliações

O gabarito **não chega ao navegador antes da resposta**. A página recebe
`avaliacaoPublica()`, sem `answerIndex`, `explanation`, `wrongExplanations`,
`solution` e sem os testes marcados como `hidden`. A correção de alternativa
acontece em `POST /api/avaliacoes/[id]`.

Em questão prática, os testes rodam no navegador e o servidor reexecuta as
verificações estruturais (determinísticas). A interface diz isso.

O que o servidor **não** pode reexecutar é o resultado dos testes: código de
quem estuda nunca roda aqui. Então esse resultado chega do cliente, e três
coisas seguem disso:

- o número de casos vem do servidor, que conhece a questão; do cliente vem só
  quantos passaram, limitado ao que existe — sem isso um cliente modificado
  gravaria "99 de 0";
- o registro marca a parte informada com `modo: "execucao-informada"`, para o
  dado não confundir o que foi verificado aqui com o que foi recebido;
- o limite não achata resultado honesto: três de cinco continua três.

Burlar isso só prejudica quem burla — não há nota, ranking nem certificado. O
ponto não é desconfiar da pessoa, é o registro não afirmar uma certeza que não
existe. Coberto em `tests/integracao.test.ts`, junto das guardas de tentativa
finalizada, dupla finalização e tentativa de outra avaliação.

Tentativas nunca são apagadas.

### IA

- A chave só existe no servidor. Nunca em resposta de API, HTML, cookie,
  `localStorage` ou variável com prefixo público.
- Chave por usuário é cifrada com AES-256-GCM derivada de `APP_SECRET`. A API
  devolve no máximo `keyHint` (4 últimos caracteres).
- Sem chave: o app funciona igual, os botões continuam visíveis e clicar mostra
  "A IA não está configurada neste ambiente." **Nenhuma chamada é feita.**
- Controle de custo: limite diário por usuário reservado *antes* da chamada,
  limite por minuto, timeout, **uma** retentativa apenas para falha transitória,
  e registro de toda chamada em `AIRequest` + `AIUsage`.
- Demanda gerada por IA passa pelo mesmo schema Zod das demandas do currículo;
  se não passar, é descartada. A interface marca como gerada automaticamente.

### Recuperação de senha

Token de 32 bytes: o valor cru só existe no link do email, e o banco guarda
apenas o SHA-256 (`PasswordReset.tokenHash`). Vale 60 minutos, é de uso único, e
pedir um novo invalida os anteriores da conta.

A resposta do pedido é SEMPRE a mesma — mesma mensagem, mesmo status — inclusive
quando a conta não existe e quando o limite foi atingido. Diferença de texto,
status ou tempo transformaria a tela num verificador de cadastros.

Ao redefinir, `revokeAllSessions` encerra todas as sessões.

O envio fica em `src/lib/email.ts`, com dois transportes (`console` e `http`) e
sem SDK. Sem transporte em produção, o envio falha de forma explícita e o log
diz o motivo: nunca fingir que enviou.

### Leitura offline

Três peças:

1. `public/sw.js` — service worker. Guarda `/_next/static`, `/api/conteudo/*` e a
   casca de `/leitura-offline`. **Nunca** guarda HTML de tela autenticada nem
   resposta de API com dado de usuário: cache sobrevive ao logout. Quando uma
   navegação falha, redireciona para `/leitura-offline?caminho=<original>` —
   responder com o HTML de outra página mantendo a URL quebraria o roteador do
   Next.
2. `src/lib/offline.ts` — cache de conteúdo (Cache Storage) e fila de progresso
   (localStorage).
   Guardar a casca HTML da tela offline NÃO basta: sem o JavaScript da rota
   ela abre, mostra "Carregando" e fica nisso para sempre, porque o React não
   hidrata. Por isso `baixarModulo` lê os `/_next/static/...` do próprio HTML
   da casca e guarda também. Os nomes mudam a cada build, então não podem ser
   escritos à mão. Coberto por `tests/offline-cache.test.ts`.

3. `/leitura-offline` — pública de propósito, porque é a única página que o
   service worker guarda em cache. Renderiza com os mesmos componentes da tela
   online.

Conflitos, resolvidos de forma previsível: `concluir` é idempotente e nunca
rebaixa status; a fila guarda uma entrada por conteúdo e ação, somando o tempo;
cada evento leva `ocorridoEm`, e `touchProgress` só move o ponto de parada
quando o evento é mais recente que o último acesso.

O service worker é registrado apenas em build de produção
(`SincronizacaoOffline`). Em desenvolvimento ele brigaria com a recarga
automática do Next.

Ao adicionar um recurso novo: se ele expõe dado de usuário numa rota
`/api/...`, não faça nada — o service worker já ignora tudo que não seja
`/api/conteudo/`. Só tome cuidado ao criar rota de conteúdo público.

### Recomendação de próximo passo

`src/lib/next-step.ts`, na ordem da spec: conteúdo interrompido > demanda em
andamento > projeto em andamento > exercício pendente > revisão > próximo
conteúdo. O orçamento de tempo filtra por duração com folga de 5 minutos.

## Convenções

- Nomes de domínio em português (`Botao`, `Cartao`, `renderizarInline`); nomes
  de campo do Prisma em inglês, como o schema.
- Comentário explica **por quê**, não o quê. Comentário que repete o código sai.
- Server Component por padrão. `'use client'` só quando há estado, evento ou API
  de navegador.
- Nenhum `dangerouslySetInnerHTML`. Texto de conteúdo e resposta de IA são
  renderizados como elementos React (`texto-inline.tsx`, `markdown-simples.tsx`).
- Mensagem de erro técnico: o que aconteceu, se o trabalho foi perdido, o que
  fazer agora. Nunca stack trace para o usuário.
- Toda tela com dados trata quatro estados: carregando, vazio, erro, sucesso.

## Testes

`npm test`. O banco de teste é recriado a cada execução em
`prisma/test-vitest.db` (`tests/global-setup.ts` roda `prisma db push` e
`content:sync`); o banco de desenvolvimento nunca é tocado.

Ambiente padrão é node. Teste de componente declara `// @vitest-environment
jsdom` na primeira linha do arquivo.

`next/headers` é substituído por um pote de cookies em memória nos testes que
tocam sessão — é a única parte do Next de que a camada de sessão depende. Rotas
de API são chamadas direto, com `{ params: Promise.resolve({ id }) }` no segundo
argumento.

Os arquivos rodam em série (`fileParallelism: false`): compartilham o mesmo
SQLite.

Ao criar um recurso por usuário, o teste de isolamento ("A não alcança o de B")
é obrigatório — veja `tests/integracao.test.ts`.

## Acessibilidade (obrigatório, não opcional)

- Tudo que clica é `button` ou `a` — nunca `div` com `onClick`.
- Todo campo tem `label` ligada por `for`/`id`; erro com `aria-invalid`,
  `role="alert"` e texto (nunca só a cor da borda).
- Foco sempre visível (`:focus-visible` global). Nunca `outline: none` sem
  substituto.
- Alvo de toque mínimo de 44px nos botões. `Botao` e `BotaoLink` têm um
  tamanho só, justamente para que não exista como burlar isso.
- Campo de senha traz botão "Mostrar/Ocultar senha". O rótulo muda com o
  estado e o sufixo fica em `sr-only`: o nome acessível diz a ação, sem
  alargar o botão em 360px.
- Layout mobile first: testar em 360px, sem scroll horizontal.

## Ao adicionar conteúdo

1. Siga o schema em `src/lib/content/schema.ts`.
2. Regras verificadas por `npm run content:validate`:
   - item com no máximo 20 minutos estimados;
   - módulo precisa ter prática (aviso abaixo de 50% das aulas);
   - `answerIndex` dentro das alternativas;
   - exercício de código precisa de `tests` ou `checks`;
   - avaliação `alternativa` não mistura questão prática (e vice-versa);
   - termo de glossário citado precisa existir.
3. Toda aula responde "Por que isso existe?" em uma frase. Se não responde, ela
   não precisa existir.
4. Exercício de código: inclua sempre o caso vazio e um caso de borda.

## Antes de considerar uma funcionalidade pronta

- É útil para quem tem 10 minutos?
- Funciona sem estudar todos os dias, e não pune interrupção?
- Evita gamificação e não exige trocar de janela?
- Existe prática, e a atividade parece trabalho real?
- Dados isolados por usuário, com teste que prova?
- Responsivo em 360px, navegável por teclado?
- A chave de IA continua só no servidor e o limite diário funciona?
- O app continua inteiro com a IA desligada?
