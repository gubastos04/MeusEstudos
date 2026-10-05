'use client'

import { useEffect, useRef, useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import type { Exercise } from '@/lib/content/schema'
import { capabilityFor, runExercise, runtimeSobDemanda, type RunOutcome } from '@/lib/runner'
import { EditorCodigo } from './editor-codigo'
import { renderizarInline } from './texto-inline'
import { Aviso, Botao, Nota, Selo, juntar } from './ui'

/**
 * Exercicio.
 *
 * Exercicio e para aprender, nao para medir (spec 25.9): dicas progressivas,
 * tentativas ilimitadas e solucao disponivel sob pedido.
 *
 * O resultado dos testes e sempre rotulado com o tipo de verificacao:
 * execucao real ou leitura estrutural. A interface nao finge que uma checagem
 * por padrao prova que o codigo funciona.
 */

type Props = {
  exercicio: Exercise
  moduloId: string
  aulaId: string
  /** Ultimo codigo enviado pela pessoa, vindo do servidor. */
  codigoSalvo?: string | null
  tamanhoFonte?: number
}

const CHAVE_RASCUNHO = (id: string) => `rascunho:${id}`

export function Exercicio({ exercicio, moduloId, aulaId, codigoSalvo, tamanhoFonte = 14 }: Props) {
  const [codigo, setCodigo] = useState(codigoSalvo || exercicio.starter || '')
  const [resultado, setResultado] = useState<RunOutcome | null>(null)
  const [rodando, setRodando] = useState(false)
  const [dicasAbertas, setDicasAbertas] = useState(0)
  const [solucaoVisivel, setSolucaoVisivel] = useState(false)
  const [permitiuRuntime, setPermitiuRuntime] = useState(false)
  const [escolhaQuiz, setEscolhaQuiz] = useState<number | null>(null)
  const [reflexao, setReflexao] = useState('')
  const [concluido, setConcluido] = useState(false)
  const jaRegistrou = useRef(false)

  const capacidade = capabilityFor(exercicio.language, exercicio.tests)
  const runtime = runtimeSobDemanda(exercicio.language)
  const precisaAutorizar = capacidade === 'execucao-sob-demanda' && !permitiuRuntime

  // Rascunho local: se a pessoa fecha a aba no meio, o codigo continua ali.
  // E apenas cache; o registro oficial da tentativa fica no servidor.
  useEffect(() => {
    if (codigoSalvo) return
    try {
      const guardado = localStorage.getItem(CHAVE_RASCUNHO(exercicio.id))
      if (guardado) setCodigo(guardado)
    } catch {
      // Navegacao privada ou armazenamento bloqueado: segue sem rascunho.
    }
  }, [exercicio.id, codigoSalvo])

  useEffect(() => {
    if (!codigo) return
    const relogio = setTimeout(() => {
      try {
        localStorage.setItem(CHAVE_RASCUNHO(exercicio.id), codigo)
      } catch {
        // Sem armazenamento: nada a fazer, o editor continua funcionando.
      }
    }, 600)
    return () => clearTimeout(relogio)
  }, [codigo, exercicio.id])

  async function executar() {
    if (rodando) return
    setRodando(true)

    const saida = await runExercise({
      code: codigo,
      language: exercicio.language,
      tests: exercicio.tests,
      checks: exercicio.checks,
      allowHeavyRuntime: permitiuRuntime,
    })

    setResultado(saida)
    setRodando(false)

    await registrar({
      passou: saida.passed,
      totalCasos: saida.totalCount,
      casosPassaram: saida.passedCount,
      relatorio: saida.cases.map((caso) => ({
        nome: caso.name,
        passou: caso.passed,
        modo: caso.mode,
      })),
    })
  }

  async function registrar(dados: {
    passou: boolean
    totalCasos: number
    casosPassaram: number
    relatorio: unknown
  }) {
    await enviar('/api/exercicios', {
      exercicioId: exercicio.id,
      aulaId,
      moduloId,
      codigo,
      linguagem: exercicio.language,
      dicasUsadas: dicasAbertas,
      solucaoVista: solucaoVisivel,
      ...dados,
    })
  }

  async function marcarFeito() {
    if (jaRegistrou.current) return
    jaRegistrou.current = true
    setConcluido(true)
    await registrar({ passou: true, totalCasos: 0, casosPassaram: 0, relatorio: [] })
  }

  // --- Exercicio de alternativa ---------------------------------------------
  if (exercicio.kind === 'quiz' && exercicio.choices && exercicio.answerIndex !== undefined) {
    const respondido = escolhaQuiz !== null
    const acertou = escolhaQuiz === exercicio.answerIndex

    return (
      <Moldura exercicio={exercicio}>
        <ul className="space-y-1.5">
          {exercicio.choices.map((alternativa, indice) => {
            const escolhida = escolhaQuiz === indice
            const correta = indice === exercicio.answerIndex

            let estilo = 'border-line bg-surface hover:border-line-strong'
            if (respondido && correta) estilo = 'border-ok/50 bg-ok-soft'
            else if (respondido && escolhida) estilo = 'border-danger/50 bg-danger-soft'
            else if (respondido) estilo = 'border-line bg-surface opacity-70'

            return (
              <li key={indice}>
                <button
                  type="button"
                  onClick={() => {
                    setEscolhaQuiz(indice)
                    void registrar({
                      passou: indice === exercicio.answerIndex,
                      totalCasos: 1,
                      casosPassaram: indice === exercicio.answerIndex ? 1 : 0,
                      relatorio: [{ nome: 'alternativa', passou: indice === exercicio.answerIndex, modo: 'execucao' }],
                    })
                  }}
                  aria-pressed={escolhida}
                  className={juntar(
                    'flex w-full items-start gap-2.5 rounded border px-3 py-2.5 text-left text-sm transition',
                    estilo,
                  )}
                >
                  <span className="text-ink-faint mt-px font-mono text-xs">
                    {String.fromCharCode(65 + indice)}
                  </span>
                  <span className="text-ink min-w-0 flex-1">{renderizarInline(alternativa)}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {respondido ? (
          <div
            className={juntar(
              'rounded border p-3 text-sm',
              acertou ? 'border-ok/40 bg-ok-soft text-ok-ink' : 'border-line bg-surface-sunken text-ink',
            )}
          >
            <p className="font-medium">
              {acertou
                ? 'Correto.'
                : `A alternativa correta é ${String.fromCharCode(65 + (exercicio.answerIndex ?? 0))}.`}
            </p>
            {exercicio.explanation ? <p className="mt-1">{renderizarInline(exercicio.explanation)}</p> : null}
          </div>
        ) : null}
      </Moldura>
    )
  }

  // --- Exercicio de registro escrito ----------------------------------------
  if (exercicio.kind === 'reflection') {
    return (
      <Moldura exercicio={exercicio}>
        <label htmlFor={`reflexao-${exercicio.id}`} className="text-ink block text-sm font-medium">
          Sua resposta
        </label>
        <textarea
          id={`reflexao-${exercicio.id}`}
          value={reflexao}
          onChange={(evento) => setReflexao(evento.target.value)}
          rows={7}
          className="border-line bg-surface-raised text-ink w-full rounded border px-3 py-2.5 text-base leading-relaxed"
          placeholder="Escreva aqui. Ninguém corrige automaticamente: o valor está em organizar o raciocínio."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Botao type="button" variante="primario" onClick={marcarFeito} disabled={concluido || reflexao.trim().length < 10}>
            {concluido ? 'Registrado' : 'Marcar como feito'}
          </Botao>
          {exercicio.solution ? (
            <Botao type="button" variante="secundario" onClick={() => setSolucaoVisivel((v) => !v)}>
              {solucaoVisivel ? 'Esconder exemplo de resposta' : 'Ver um exemplo de resposta'}
            </Botao>
          ) : null}
        </div>

        {solucaoVisivel && exercicio.solution ? (
          <Nota titulo="Um exemplo de resposta">
            <p className="whitespace-pre-wrap leading-relaxed">{exercicio.solution}</p>
            {exercicio.solutionNotes ? (
              <p className="text-ink-faint mt-2">{renderizarInline(exercicio.solutionNotes)}</p>
            ) : null}
          </Nota>
        ) : null}
      </Moldura>
    )
  }

  // --- Exercicio de codigo ---------------------------------------------------
  return (
    <Moldura exercicio={exercicio}>
      {capacidade === 'estrutura' && exercicio.tests.length === 0 ? (
        <Nota titulo="Como este exercício é verificado">
          A plataforma lê o seu código e procura pelos pontos-chave. Isso não prova que ele funciona —
          é um roteiro de conferência, não um teste de verdade.
        </Nota>
      ) : null}

      <EditorCodigo
        rotulo="Seu código"
        valor={codigo}
        aoMudar={setCodigo}
        linguagem={exercicio.language}
        altura={260}
        tamanhoFonte={tamanhoFonte}
      />

      {precisaAutorizar ? (
        <Aviso titulo={`Rodar ${runtime?.nome ?? 'isto'} aqui precisa de um download`}>
          <p>
            O {runtime?.nome ?? 'runtime'} roda dentro do navegador e tem {runtime?.tamanho ?? 'alguns megabytes'}.
            Em rede móvel, vale esperar o wi-fi. Sem isso, a verificação estrutural continua disponível.
          </p>
          <Botao
            type="button"
            variante="secundario"
            className="mt-3"
            onClick={() => setPermitiuRuntime(true)}
          >
            Baixar e executar
          </Botao>
        </Aviso>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Botao type="button" variante="primario" onClick={executar} disabled={rodando || precisaAutorizar}>
          {rodando ? 'Executando…' : exercicio.tests.length > 0 ? 'Executar testes' : 'Verificar'}
        </Botao>

        <Botao
          type="button"
          variante="discreto"
          onClick={() => {
            setCodigo(exercicio.starter || '')
            setResultado(null)
          }}
        >
          Recomeçar
        </Botao>

        {exercicio.hints.length > dicasAbertas ? (
          <Botao type="button" variante="secundario" onClick={() => setDicasAbertas((n) => n + 1)}>
            {dicasAbertas === 0 ? 'Ver uma dica' : 'Ver próxima dica'}
          </Botao>
        ) : null}

        {exercicio.solution ? (
          <Botao type="button" variante="discreto" onClick={() => setSolucaoVisivel((v) => !v)}>
            {solucaoVisivel ? 'Esconder solução' : 'Mostrar solução'}
          </Botao>
        ) : null}
      </div>

      {dicasAbertas > 0 ? (
        <div className="space-y-2">
          {exercicio.hints.slice(0, dicasAbertas).map((dica, indice) => (
            <Nota key={indice} titulo={`Dica ${indice + 1}`}>
              {renderizarInline(dica)}
            </Nota>
          ))}
        </div>
      ) : null}

      {resultado ? <Resultado resultado={resultado} /> : null}

      {solucaoVisivel && exercicio.solution ? (
        <div className="space-y-2">
          <EditorCodigo
            rotulo="Uma solução possível"
            valor={exercicio.solution}
            aoMudar={() => undefined}
            linguagem={exercicio.language}
            somenteLeitura
            altura={220}
            tamanhoFonte={tamanhoFonte}
          />
          {exercicio.solutionNotes ? (
            <Nota titulo="Sobre esta solução">{renderizarInline(exercicio.solutionNotes)}</Nota>
          ) : null}
        </div>
      ) : null}
    </Moldura>
  )
}

function Moldura({ exercicio, children }: { exercicio: Exercise; children: React.ReactNode }) {
  return (
    <section
      id="exercicio"
      aria-labelledby={`exercicio-${exercicio.id}`}
      className="border-line bg-surface-raised space-y-4 rounded-lg border p-4 md:p-5"
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Selo tom="accent">Exercício</Selo>
          <Selo>{exercicio.estimatedMinutes} min</Selo>
          <Selo>{exercicio.language}</Selo>
        </div>
        <h3 id={`exercicio-${exercicio.id}`} className="text-lg">
          {exercicio.title}
        </h3>
        <p className="text-ink leading-relaxed whitespace-pre-line">{renderizarInline(exercicio.prompt)}</p>
        {exercicio.expectedResult ? (
          <p className="text-ink-muted text-sm">
            <span className="text-ink-faint">Resultado esperado: </span>
            {renderizarInline(exercicio.expectedResult)}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  )
}

function Resultado({ resultado }: { resultado: RunOutcome }) {
  const temExecucao = resultado.cases.some((caso) => caso.mode === 'execucao')

  return (
    <div className="space-y-3" aria-live="polite">
      {resultado.error ? (
        <div className="border-danger/40 bg-danger-soft text-danger-ink rounded border p-3 text-sm">
          <p className="font-medium">O código não chegou a rodar</p>
          <p className="mt-1 font-mono text-xs break-words">{resultado.error}</p>
        </div>
      ) : null}

      {resultado.cases.length > 0 ? (
        <div className="border-line overflow-hidden rounded border">
          <div className="border-line bg-surface-sunken flex items-center justify-between border-b px-3 py-2">
            <span className="text-ink text-sm font-medium">
              {temExecucao ? 'Testes' : 'Verificação estrutural'}
            </span>
            <span className={juntar('text-sm tabular-nums', resultado.passed ? 'text-ok-ink' : 'text-ink-muted')}>
              {resultado.passedCount} de {resultado.totalCount}
            </span>
          </div>

          <ul className="divide-line divide-y">
            {resultado.cases.map((caso, indice) => (
              <li key={indice} className="px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <span
                    className={juntar(
                      'mt-0.5 font-mono text-xs font-semibold',
                      caso.passed ? 'text-ok-ink' : 'text-danger-ink',
                    )}
                  >
                    {caso.passed ? '[OK]' : '[ERRO]'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink">{caso.name}</p>

                    {!caso.passed && caso.message ? (
                      <p className="text-danger-ink mt-1 font-mono text-xs break-words">{caso.message}</p>
                    ) : null}

                    {!caso.passed && caso.expected !== undefined && !caso.message ? (
                      <dl className="text-ink-muted mt-1 space-y-0.5 font-mono text-xs">
                        <div className="flex gap-2">
                          <dt className="text-ink-faint shrink-0">esperado</dt>
                          <dd className="break-words">{caso.expected}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-ink-faint shrink-0">recebido</dt>
                          <dd className="break-words">{caso.received ?? '—'}</dd>
                        </div>
                      </dl>
                    ) : null}

                    {caso.mode === 'estrutura' ? (
                      <p className="text-ink-faint mt-1 text-xs">verificação por leitura do código</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {resultado.output.length > 0 ? (
        <details className="border-line bg-surface-code rounded border">
          <summary className="text-ink-muted cursor-pointer px-3 py-2 text-sm">
            Saída do console ({resultado.output.length} linha{resultado.output.length > 1 ? 's' : ''})
          </summary>
          <pre className="text-ink overflow-x-auto px-3 pb-3 text-xs leading-relaxed">
            <code>{resultado.output.join('\n')}</code>
          </pre>
        </details>
      ) : null}

      {resultado.passed ? (
        <p className="text-ok-ink text-sm">
          Passou em todos os casos. {temExecucao ? 'O código foi executado de verdade.' : ''}
        </p>
      ) : null}
    </div>
  )
}
