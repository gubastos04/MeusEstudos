# Meus Estudos

Plataforma de estudos práticos de programação, baseada na grade de Análise e
Desenvolvimento de Sistemas, para quem estuda sozinho — quase sempre no celular,
depois do trabalho, em blocos de 10 ou 20 minutos.

Não é faculdade online e não é bootcamp. O objetivo é levar alguém de "não sei
programar" até "consigo receber uma demanda, entender o problema, pesquisar,
implementar, testar, versionar e explicar o que fiz".

## O que ela faz

- **Conteúdo curto**: 21 módulos, 105 itens de 3 a 15 minutos, cada um com motivo
  de existir, algo para fazer e o erro comum daquele assunto.
- **Exercícios que rodam**: 71 exercícios com testes executados de verdade no
  navegador (JavaScript e TypeScript sempre; Python sob confirmação, via Pyodide).
- **Demandas**: 10 tickets como chegam num time — com contexto de negócio,
  critérios de aceite, restrições e, em parte deles, contexto incompleto de
  propósito (log, métrica e consulta para investigar antes de implementar).
- **Projetos evolutivos**: 5 sistemas que poderiam existir numa empresa,
  divididos em etapas com entregável próprio, do levantamento de requisitos ao
  deploy e à documentação.
- **Desafios**: 10 problemas fechados, de lógica a performance, sem pontuação.
- **Avaliações**: alternativa e prática, corrigidas no servidor, sem nota e sem
  ranking — o resultado diz o que você demonstrou e o que vale revisar.
- **Meus erros**: registro de erro, causa, solução e aprendizado, que volta
  depois como revisão.
- **Anotações e glossário**: 57 termos pesquisáveis, disponíveis dentro da aula.
- **Leitura offline**: baixe um módulo e leia sem conexão. O que você marcar
  offline entra numa fila e sobe quando a rede voltar.
- **IA opcional**: corretor, explicação alternativa, pergunta livre, debugger,
  code review e geração de demanda. Desligada por padrão.

## O que ela não faz

Sem pontos, XP, níveis, medalhas, ranking, moedas ou confete. Sem streak e sem
contador de dias perdidos — a métrica de constância é *dias ativos nos últimos
7*. Sem notificação que cobra. Sem cronograma obrigatório.

Um dia sem estudar não apaga nada:

> O número que importa não é a sequência perfeita. É o total que não volta pra trás.

## Rodando localmente

Requisitos: Node 20.11 ou superior.

```bash
git clone <seu-repositorio>
cd MeusEstudos
cp .env.example .env
```

Gere o segredo da aplicação e coloque em `APP_SECRET` no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Depois:

```bash
npm run setup
npm run dev
```

Abra `http://localhost:3000`, crie uma conta e responda as quatro perguntas do
início rápido.

`npm run setup` instala dependências, gera o client do Prisma, cria o banco
SQLite em `prisma/dev.db`, espelha o conteúdo de `/content` no banco e roda o
seed.

### Comandos

```bash
npm run dev               # desenvolvimento
npm run build             # build de produção
npm start                 # servidor de produção
npm run typecheck         # verificação de tipos
npm test                  # testes
npm run content:validate  # valida /content (bom para CI)
npm run content:sync      # espelha /content no banco
npm run db:studio         # inspeciona os dados
npm run db:migrate:status # migrations pendentes (produção)
npm run db:migrate:deploy # aplica migrations (produção)
```

## Testes

```bash
npm test
```

117 testes em oito arquivos. O banco de teste é criado do zero a cada execução em
`prisma/test-vitest.db`, com o conteúdo de `/content` sincronizado — nenhum teste
toca o banco de desenvolvimento.

| Arquivo | O que trava |
| --- | --- |
| `tests/conteudo.test.ts` | Schema e regras de produto de `/content`: item com no máximo 20 min, módulo com prática, `answerIndex` válido, exercício de coleção cobrindo o caso vazio, referências de glossário e trilha |
| `tests/seguranca.test.ts` | Senha nunca em claro, salt por usuário, chave de IA ilegível sem o `APP_SECRET`, token de sessão só como hash |
| `tests/avaliacoes.test.ts` | O gabarito não chega ao navegador; resumo por tópico; verificação estrutural; escolha do modo de execução |
| `tests/integracao.test.ts` | Cadastro → login → concluir bloco → sair → entrar de outro dispositivo com progresso preservado; isolamento entre usuários; correção no servidor; IA desligada sem gastar chamada; recusa de origem estranha |
| `tests/proximo-passo.test.ts` | Um único próximo passo, ordem de prioridade, orçamento de tempo, dias ativos sem streak, rate limiting |
| `tests/senha-e-offline.test.ts` | Link de redefinição de uso único e com prazo, hash em vez do token, resposta idêntica para email com e sem conta, revogação de sessões; conteúdo offline sem dado de usuário; replay da fila sem duplicar nem voltar atrás |
| `tests/typescript-runner.test.ts` | Remoção de tipos antes de executar: interface em uma ou várias linhas, união com null, `as`, e o ternário que não pode ser confundido com anotação |
| `tests/componentes.test.tsx` | Conteúdo e resposta da IA nunca viram HTML; checkpoint se comporta como exercício |

O workflow em `.github/workflows/ci.yml` roda validação de conteúdo, typecheck,
testes e build a cada push e pull request.

## Configuração

Tudo em `.env` (veja `.env.example` para a lista comentada).

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão do banco |
| `APP_SECRET` | sim em produção | Assina sessões e cifra a chave de IA |
| `APP_URL` | recomendada | Verificação de origem (proteção contra CSRF) |
| `APP_TIMEZONE` | não | Fuso usado para fechar o dia das métricas |
| `PERMITIR_CADASTRO` | não | `false` fecha novos cadastros |
| `MAIL_HTTP_URL` | em produção | Provedor de email para o link de redefinição de senha |
| `MAIL_FROM` | em produção | Remetente usado nesse email |
| `MAIL_TRANSPORTE` | não | `console` escreve o email no log (desenvolvimento) |
| `ANTHROPIC_API_KEY` | não | Liga a IA. Sem ela, o app funciona igual |
| `IA_MODELO` | não | Modelo usado (padrão `claude-sonnet-5`) |
| `IA_LIMITE_DIARIO` | não | Teto de chamadas por usuário por dia |

Trocar `APP_SECRET` invalida todas as sessões e torna ilegíveis as chaves de IA
já salvas pelos usuários.

## IA (opcional)

A plataforma funciona inteira sem IA. Sem chave configurada, os botões de IA
continuam visíveis; ao clicar, aparece um aviso curto e **nenhuma chamada é
feita** — não existe caminho para gerar custo acidental.

Com chave, existem seis ferramentas contextuais: corretor, explicar de outro
jeito, pergunta livre, gerar demanda, debugger e code review.

Controle de custo: limite diário por usuário (reservado antes da chamada),
limite por minuto, timeout, uma única retentativa para falha transitória e
registro de todo consumo.

A chave fica **só no servidor**. Cada usuário pode configurar a própria chave em
Perfil; ela é cifrada com AES-256-GCM e nunca é devolvida por nenhuma rota — a
interface mostra apenas os quatro últimos caracteres.

## Recuperação de senha

Em `/entrar` há o link **Esqueci minha senha**. O fluxo:

1. A pessoa informa o email. A resposta é sempre a mesma, exista ou não a conta —
   caso contrário a tela viraria um verificador de quem tem cadastro.
2. Chega um link válido por 60 minutos e de uso único. O banco guarda apenas o
   SHA-256 do token; o valor do link não fica em lugar nenhum do servidor.
3. Ao definir a nova senha, **todas as sessões são encerradas**: quem redefine a
   senha costuma desconfiar de acesso indevido.

Pedir um link novo invalida o anterior. Há limite por email e por IP.

O envio não depende de SDK nenhum. São dois transportes:

- `MAIL_TRANSPORTE=console` escreve o email no log do servidor — é o padrão fora
  de produção, para o link ficar acessível sem provedor nenhum;
- `MAIL_TRANSPORTE=http` faz `POST {from, to, subject, text}` em
  `MAIL_HTTP_URL`, com `MAIL_HTTP_TOKEN` no cabeçalho. Funciona com Resend,
  Postmark ou uma função sua.

Sem transporte configurado em produção, o pedido é registrado no log como não
entregue e a pessoa recebe a mesma mensagem genérica. A plataforma nunca finge
que enviou.

## Leitura offline

Na tela de um módulo existe **Baixar para ler offline**. O conteúdo vai para o
Cache Storage do aparelho e fica legível em `/leitura-offline`, com os mesmos
componentes da tela online.

O que vai para o cache é currículo, e só currículo. Progresso, anotações, erros
e demandas continuam apenas no servidor: cache sobrevive ao logout, e guardar
dado de conta ali entregaria a conta para quem pegasse o aparelho depois. Pelo
mesmo motivo, o service worker nunca guarda HTML de tela autenticada nem
resposta de API com dado de usuário.

O que você marca offline entra numa fila local e sobe quando a conexão volta. As
regras de conflito são explícitas:

- `concluir` é idempotente no servidor e nunca rebaixa status — reenviar não
  duplica nem apaga;
- a fila guarda uma entrada por conteúdo e ação, somando o tempo, então o mesmo
  minuto não é contado duas vezes;
- cada evento leva o momento em que aconteceu, e o servidor só move o ponto de
  parada quando o evento é mais recente que o último acesso registrado.

O service worker é registrado **apenas em build de produção** — em
desenvolvimento ele brigaria com a recarga automática do Next. Para testar:
`npm run build && npm start`.

## Deploy

Testado com Neon (PostgreSQL) + Vercel. O banco de produção já existe e está
populado; a aplicação em si ainda não foi publicada.

O Prisma lê **somente** `DATABASE_URL`: mesmo nome nos dois ambientes, valor
diferente. SQLite no `.env` local, a string do Neon nas variáveis da Vercel.
Não há variável separada para produção.

### 1. Banco

```bash
npx prisma db push
```

Com `DATABASE_URL` apontando para o PostgreSQL e o provider trocado
(`npm run deploy:preparar`). Depois, `npm run content:sync` no mesmo banco —
sem isso o site sobe sem nenhum módulo, porque as tabelas de conteúdo são
espelho de `/content`.

Ao voltar a desenvolver: `npm run db:provider sqlite && npx prisma generate`.

### 2. Vercel

**Build Command:**

```
npm run db:provider postgresql && npm run build
```

O repositório versiona `provider = "sqlite"`, que é o que faz o dev e os testes
funcionarem num clone limpo. Sem essa troca no build, a Vercel gera um client
de SQLite e conecta num PostgreSQL — o erro aparece em runtime, não no build.

**Region:** a mesma do banco (`gru1` para um Neon em `sa-east-1`).

**Variáveis de ambiente:**

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | string de conexão do PostgreSQL (a pooled, no caso do Neon) |
| `APP_SECRET` | 48 bytes aleatórios; em produção o app recusa subir com menos de 32 caracteres |
| `APP_URL` | a URL pública, usada no link de recuperação de senha |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Trocar `APP_SECRET` depois invalida todas as sessões e torna ilegíveis as
chaves de IA já salvas. Defina uma vez.

Opcionais: `MAIL_HTTP_URL`, `MAIL_HTTP_TOKEN` e `MAIL_FROM` (sem elas a
recuperação de senha falha de forma explícita) e `ANTHROPIC_API_KEY`.

### 3. Conferir

Crie uma conta, conclua um item, rode um exercício. Não há conta de
demonstração: o seed recusa rodar com `NODE_ENV=production`.

### Alterando o schema depois

`prisma db push` resolve enquanto não houver dados de usuário que importem.
Quando houver, `db push` passa a ser arriscado — ele pode remover coluna em
silêncio. O marco em `prisma/migrations/0_inicial` existe para esse dia: basta
`prisma migrate resolve --applied 0_inicial` e seguir com `migrate deploy`.

Antes de remover uma coluna, faça dois deploys: primeiro pare de usar, depois
remova. Durante o deploy, código antigo e novo rodam ao mesmo tempo.

## Adicionando conteúdo

O conteúdo é JSON versionado em `/content`. Não há CMS.

1. Crie o arquivo (por exemplo `content/semestre-1/meu-modulo.json`) seguindo o
   schema de `src/lib/content/schema.ts`.
2. `npm run content:validate` — além do schema, ele verifica regras do produto:
   item com no máximo 20 minutos, módulo com prática, `answerIndex` válido,
   exercício de código com testes, termo de glossário existente.
3. `npm run content:sync`.

Conteúdo inválido não derruba a aplicação: o arquivo com problema é isolado e o
resto continua carregando.

Formato de um item:

```
Título · duração estimada
Por que isso existe?      uma frase
O que você vai fazer      resultado concreto
Blocos curtos             texto, código, lista, tabela, aviso, checkpoint
Tente agora               sempre há algo para fazer
Se travar                 pistas, não respostas
Erro comum                erro, causa, correção
Exercício                 testes reais ou verificação estrutural
```

## Arquitetura

```
Navegador ──> Next.js (App Router)
                ├── Server Components: leem /content e o banco
                ├── Route handlers: sessão, origem, Zod, isolamento por usuário
                └── Client Components: editor, runner, formulários
                         │
                         ├── Web Worker: executa os testes do exercício
                         └── /api/ia ──> Anthropic (chave só no servidor)
                                 │
                            Prisma ──> SQLite (dev) / PostgreSQL (prod)
```

Decisões e convenções estão em [CLAUDE.md](CLAUDE.md).

## Segurança

- Senha com `scrypt` (N=2^16) e salt por usuário; o banco nunca vê a senha.
- Sessão em cookie `HttpOnly; Secure; SameSite=Lax`, com apenas o hash do token
  no banco.
- Login com resposta idêntica para email inexistente e senha errada.
- Toda rota mutável verifica a origem da requisição.
- `userId` vem sempre da sessão; nenhuma rota aceita identificador do cliente.
- Rate limiting persistido (login, cadastro e IA) — funciona com várias
  instâncias.
- Entrada validada com Zod em toda rota; consultas sempre parametrizadas pelo
  Prisma.
- Nenhum `dangerouslySetInnerHTML`, inclusive nas respostas da IA.
- Exclusão de conta apaga todos os dados em cascata.

## Limitações conhecidas

- Python no navegador depende de baixar o Pyodide de uma CDN (configurável em
  `NEXT_PUBLIC_PYODIDE_URL`). Sem rede, o exercício cai para verificação
  estrutural, com aviso.
- Os testes de exercício rodam no navegador. Para exercício isso é adequado; nas
  avaliações, as questões de alternativa são corrigidas no servidor, e as
  práticas têm as verificações estruturais refeitas lá.
- Linguagens sem runtime embarcado (SQL, HTML, YAML, PHP) usam verificação
  estrutural — que lê o código e não prova que ele funciona. A interface diz
  isso em toda ocorrência.
- A leitura offline cobre o texto da aula, o "tente agora", os erros comuns e o
  glossário. O editor de código, os testes e a IA precisam de conexão — a tela
  diz isso em vez de oferecer um botão que não funcionaria.
- O service worker só é registrado em build de produção, e navegador embutido
  de ferramenta costuma bloquear o registro. Verifique num navegador comum.
- O envio do email de redefinição depende de um provedor HTTP configurado. Sem
  ele, em produção, o pedido é registrado como não entregue.
