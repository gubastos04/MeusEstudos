'use client'

import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { MarkdownSimples } from './markdown-simples'
import { Aviso, Botao, Nota, Selo, juntar } from './ui'

/**
 * Ferramentas de IA, contextuais.
 *
 * Regras do produto que este componente implementa (spec 27 e 30):
 * - a IA e opcional: sem chave, os botoes continuam visiveis;
 * - ao clicar sem chave configurada, aparece um aviso curto e NENHUMA chamada
 *   e feita — nao existe caminho para gerar custo acidental;
 * - o limite diario e mostrado, e a resposta traz o restante atualizado;
 * - o corretor nao entrega a solucao por padrao: existe um pedido explicito.
 */

export type StatusIa = {
  configurada: boolean
  habilitada: boolean
  limiteDiario: number
  usadasHoje: number
  restantes: number
  mensagem: string | null
}

export type ContextoIa = {
  moduleId?: string
  moduleTitle?: string
  nodeType?: string
  nodeId?: string
  nodeTitle?: string
  language?: string
  stack?: string[]
}

type Ferramenta = {
  chave: 'explicar' | 'pergunta' | 'corretor' | 'debugger' | 'code-review' | 'gerar-demanda'
  rotulo: string
  descricao: string
  rotuloEntrada: string
  exemplo: string
  pedeCodigo?: boolean
}

const catalogo: Record<Ferramenta['chave'], Ferramenta> = {
  explicar: {
    chave: 'explicar',
    rotulo: 'Explicar de outro jeito',
    descricao: 'Mesma ideia, outra abordagem: frase curta, analogia, código e uso no trabalho.',
    rotuloEntrada: 'O que não ficou claro?',
    exemplo: 'Não entendi por que o índice composto precisa ter a coluna de igualdade primeiro.',
  },
  pergunta: {
    chave: 'pergunta',
    rotulo: 'Pergunta livre',
    descricao: 'Uma dúvida sobre o que você está estudando agora.',
    rotuloEntrada: 'Sua pergunta',
    exemplo: 'Quando vale usar transação e quando é exagero?',
  },
  corretor: {
    chave: 'corretor',
    rotulo: 'Corretor',
    descricao: 'Revisa seu código e aponta o caminho, sem entregar a resposta.',
    rotuloEntrada: 'O que o código deveria fazer',
    exemplo: 'Deveria devolver só os pedidos pendentes, mas devolve lista vazia.',
    pedeCodigo: true,
  },
  debugger: {
    chave: 'debugger',
    rotulo: 'Debugger',
    descricao: 'Ajuda a investigar um erro, ensinando o processo de diagnóstico.',
    rotuloEntrada: 'Cole o erro ou descreva o comportamento',
    exemplo: 'TypeError: unsupported operand type(s) for *: NoneType and int',
    pedeCodigo: true,
  },
  'code-review': {
    chave: 'code-review',
    rotulo: 'Code review',
    descricao: 'Revisão como em pull request: legibilidade, arquitetura, segurança, testes.',
    rotuloEntrada: 'O que este código faz',
    exemplo: 'Filtra e agrupa os pedidos para a tela de suporte.',
    pedeCodigo: true,
  },
  'gerar-demanda': {
    chave: 'gerar-demanda',
    rotulo: 'Gerar demanda',
    descricao: 'Cria um ticket fictício com as tecnologias que você está estudando.',
    rotuloEntrada: 'Sobre o que deve ser a demanda',
    exemplo: 'Uma demanda de backend com filtro e paginação, contexto incompleto.',
  },
}

export function FerramentasIa({
  status,
  contexto,
  ferramentas,
  codigoAtual,
  titulo = 'Precisa de ajuda com isso?',
}: {
  status: StatusIa
  contexto: ContextoIa
  ferramentas: Ferramenta['chave'][]
  codigoAtual?: string
  titulo?: string
}) {
  const [ativa, setAtiva] = useState<Ferramenta['chave'] | null>(null)
  const [entrada, setEntrada] = useState('')
  const [codigo, setCodigo] = useState(codigoAtual ?? '')
  const [resposta, setResposta] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [restantes, setRestantes] = useState(status.restantes)
  const [mostrarSolucao, setMostrarSolucao] = useState(false)
  const [demandaGerada, setDemandaGerada] = useState<string | null>(null)

  const indisponivel = !status.configurada || !status.habilitada || restantes <= 0
  const mensagemIndisponivel =
    !status.configurada
      ? 'A IA não está configurada neste ambiente.'
      : !status.habilitada
        ? 'A IA está desligada nas suas configurações.'
        : `Você chegou ao limite de ${status.limiteDiario} chamadas de IA hoje. O limite volta amanhã.`

  function abrir(chave: Ferramenta['chave']) {
    // Sem chave configurada, nenhuma requisicao acontece: apenas o aviso.
    if (indisponivel) {
      setAviso(mensagemIndisponivel)
      setAtiva(null)
      return
    }
    setAviso(null)
    setErro(null)
    setResposta(null)
    setDemandaGerada(null)
    setAtiva((atual) => (atual === chave ? null : chave))
  }

  async function perguntar(ferramenta: Ferramenta) {
    if (carregando || entrada.trim().length === 0) return

    setCarregando(true)
    setErro(null)
    setResposta(null)

    const retorno = await enviar<{
      texto: string
      restantes: number
      demandaId?: string
      geradaPorIa: boolean
    }>('/api/ia', {
      feature: ferramenta.chave,
      context: contexto,
      input: entrada,
      code: ferramenta.pedeCodigo ? codigo : undefined,
      revealSolution: ferramenta.chave === 'corretor' ? mostrarSolucao : false,
    })

    setCarregando(false)

    if (!retorno.ok) {
      setErro(retorno.erro)
      return
    }

    setResposta(retorno.dados.texto)
    setRestantes(retorno.dados.restantes)
    if (retorno.dados.demandaId) setDemandaGerada(retorno.dados.demandaId)
  }

  const ferramenta = ativa ? catalogo[ativa] : null

  return (
    <section aria-labelledby="ferramentas-ia" className="border-line bg-surface-raised space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ferramentas-ia" className="text-ink text-sm font-semibold">
          {titulo}
        </h2>
        {status.configurada && status.habilitada ? (
          <Selo>
            {restantes} de {status.limiteDiario} hoje
          </Selo>
        ) : (
          <Selo>IA desligada</Selo>
        )}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {ferramentas.map((chave) => {
          const item = catalogo[chave]
          const selecionada = ativa === chave
          return (
            <li key={chave}>
              <button
                type="button"
                onClick={() => abrir(chave)}
                aria-expanded={selecionada}
                className={juntar(
                  'min-h-9 rounded border px-2.5 text-sm transition',
                  selecionada
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {item.rotulo}
              </button>
            </li>
          )
        })}
      </ul>

      {aviso ? <Aviso>{aviso}</Aviso> : null}

      {ferramenta ? (
        <div className="space-y-3">
          <p className="text-ink-muted text-sm">{ferramenta.descricao}</p>

          <div className="space-y-1.5">
            <label htmlFor="ia-entrada" className="text-ink block text-sm font-medium">
              {ferramenta.rotuloEntrada}
            </label>
            <textarea
              id="ia-entrada"
              value={entrada}
              onChange={(evento) => setEntrada(evento.target.value)}
              rows={3}
              placeholder={ferramenta.exemplo}
              className="border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base leading-relaxed"
            />
          </div>

          {ferramenta.pedeCodigo ? (
            <div className="space-y-1.5">
              <label htmlFor="ia-codigo" className="text-ink block text-sm font-medium">
                Código
              </label>
              <textarea
                id="ia-codigo"
                value={codigo}
                onChange={(evento) => setCodigo(evento.target.value)}
                rows={6}
                spellCheck={false}
                className="border-line bg-surface-code text-ink w-full rounded border px-3 py-2.5 font-mono text-[13px] leading-relaxed"
              />
            </div>
          ) : null}

          {ferramenta.chave === 'corretor' ? (
            <label className="text-ink-muted flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mostrarSolucao}
                onChange={(evento) => setMostrarSolucao(evento.target.checked)}
                className="accent-accent h-4 w-4"
              />
              Mostrar a solução no fim
            </label>
          ) : null}

          <Botao
            type="button"
            variante="primario"
            onClick={() => perguntar(ferramenta)}
            disabled={carregando || entrada.trim().length === 0}
          >
            {carregando ? 'Perguntando…' : 'Enviar'}
          </Botao>

          {erro ? (
            <div role="alert" className="border-danger/40 bg-danger-soft text-danger-ink rounded border p-3 text-sm">
              {erro}
            </div>
          ) : null}

          {resposta ? (
            <div className="border-line bg-surface-sunken space-y-3 rounded border p-3">
              <p className="text-ink-faint text-xs">Resposta gerada por IA. Confira antes de aplicar.</p>
              <MarkdownSimples texto={resposta} />

              {demandaGerada ? (
                <Nota titulo="Demanda criada">
                  A demanda passou pela validação da plataforma e ficou salva em Demandas, marcada como gerada
                  automaticamente.{' '}
                  <a
                    href={`/demandas/${demandaGerada}`}
                    className="text-accent-ink font-medium underline underline-offset-2"
                  >
                    Abrir demanda
                  </a>
                </Nota>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
