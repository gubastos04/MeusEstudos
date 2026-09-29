'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import type { QuestaoPublica } from '@/lib/avaliacoes'
import { runExercise, type RunOutcome } from '@/lib/runner'
import { BlocoCodigo } from './bloco-codigo'
import { EditorCodigo } from './editor-codigo'
import { renderizarInline } from './texto-inline'
import { Botao, Cartao, Nota, Progresso, Selo, juntar } from './ui'

/**
 * Condutor de uma avaliacao.
 *
 * Diferencas em relacao ao exercicio (spec 25.9):
 * - menos ajuda: nenhuma solucao, dicas contadas;
 * - uma resposta por item, sem voltar atras;
 * - o feedback vem depois da resposta, explicando o raciocinio;
 * - o resultado e informativo: nada de nota, aprovacao ou comparacao.
 */

type Props = {
  avaliacaoId: string
  formato: 'alternativa' | 'pratica'
  questoes: QuestaoPublica[]
  tamanhoFonte?: number
}

type RespostaAlternativa = {
  correta: boolean
  indiceCorreto: number
  explicacao: string
  porQueNao: string | null
}

type RespostaPratica = {
  correta: boolean
  verificacoesEstruturais: { nome: string; passou: boolean; mensagem: string | null }[]
  criterios: string[]
}

type Resultado = {
  total: number
  respondidas: number
  corretas: number
  topicosDemonstrados: string[]
  topicosParaRevisar: string[]
}

export function Avaliacao({ avaliacaoId, formato, questoes, tamanhoFonte = 14 }: Props) {
  const router = useRouter()
  const [tentativaId, setTentativaId] = useState<string | null>(null)
  const [indice, setIndice] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [escolha, setEscolha] = useState<number | null>(null)
  const [codigo, setCodigo] = useState('')
  const [execucao, setExecucao] = useState<RunOutcome | null>(null)
  const [dicasAbertas, setDicasAbertas] = useState(0)
  const [feedbackAlternativa, setFeedbackAlternativa] = useState<RespostaAlternativa | null>(null)
  const [feedbackPratica, setFeedbackPratica] = useState<RespostaPratica | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)

  const questao = questoes[indice]
  const ultima = indice === questoes.length - 1
  const respondida = feedbackAlternativa !== null || feedbackPratica !== null

  async function iniciar() {
    if (ocupado) return
    setOcupado(true)
    setErro(null)

    const resposta = await enviar<{ tentativaId: string }>(`/api/avaliacoes/${avaliacaoId}`, {
      acao: 'iniciar',
    })

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setTentativaId(resposta.dados.tentativaId)
    const primeira = questoes[0]
    setCodigo(primeira?.starter ?? '')
  }

  async function responder() {
    if (!tentativaId || !questao || ocupado) return

    if (questao.kind !== 'pratica' && escolha === null) return

    setOcupado(true)
    setErro(null)

    const corpo =
      questao.kind === 'pratica'
        ? {
            acao: 'responder',
            tentativaId,
            questaoId: questao.id,
            codigo,
            passouTestes: execucao?.passed ?? false,
            casosPassaram: execucao?.passedCount ?? 0,
            totalCasos: execucao?.totalCount ?? 0,
            dicasUsadas: dicasAbertas,
          }
        : {
            acao: 'responder',
            tentativaId,
            questaoId: questao.id,
            escolha,
            dicasUsadas: dicasAbertas,
          }

    const resposta = await enviar<RespostaAlternativa | RespostaPratica>(
      `/api/avaliacoes/${avaliacaoId}`,
      corpo,
    )

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    if (questao.kind === 'pratica') setFeedbackPratica(resposta.dados as RespostaPratica)
    else setFeedbackAlternativa(resposta.dados as RespostaAlternativa)
  }

  async function avancar() {
    if (!ultima) {
      const proxima = questoes[indice + 1]
      setIndice((atual) => atual + 1)
      setEscolha(null)
      setCodigo(proxima?.starter ?? '')
      setExecucao(null)
      setDicasAbertas(0)
      setFeedbackAlternativa(null)
      setFeedbackPratica(null)
      return
    }

    if (!tentativaId || ocupado) return
    setOcupado(true)

    const resposta = await enviar<Resultado>(`/api/avaliacoes/${avaliacaoId}`, {
      acao: 'finalizar',
      tentativaId,
    })

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setResultado(resposta.dados)
    router.refresh()
  }

  async function executar() {
    if (!questao || ocupado) return
    setOcupado(true)

    const saida = await runExercise({
      code: codigo,
      language: questao.language ?? 'javascript',
      tests: (questao.tests ?? []) as never,
      checks: (questao.checks ?? []) as never,
      // Em avaliacao, o download do Python e autorizado ao abrir a tarefa.
      allowHeavyRuntime: true,
    })

    setExecucao(saida)
    setOcupado(false)
  }

  // --- Resultado final -------------------------------------------------------
  if (resultado) {
    return (
      <div className="space-y-4">
        <Cartao className="space-y-3">
          <h2 className="text-lg">Avaliação concluída</h2>

          <p className="text-ink text-sm">
            {resultado.corretas} de {resultado.total}{' '}
            {formato === 'pratica' ? 'tarefas resolvidas' : 'questões corretas'}.
          </p>

          <Progresso
            valor={resultado.total === 0 ? 0 : (resultado.corretas / resultado.total) * 100}
            mostrarNumero={false}
          />

          {resultado.topicosDemonstrados.length > 0 ? (
            <div className="space-y-1">
              <p className="text-ink-faint text-xs uppercase tracking-wide">Você demonstrou domínio de</p>
              <ul className="text-ink list-disc space-y-0.5 pl-5 text-sm">
                {resultado.topicosDemonstrados.map((topico) => (
                  <li key={topico}>{topico}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {resultado.topicosParaRevisar.length > 0 ? (
            <div className="space-y-1">
              <p className="text-ink-faint text-xs uppercase tracking-wide">Vale revisar</p>
              <ul className="text-ink list-disc space-y-0.5 pl-5 text-sm">
                {resultado.topicosParaRevisar.map((topico) => (
                  <li key={topico}>{topico}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Nota>
            Isto não é nota e não fica público. A tentativa fica registrada no seu histórico, e você pode
            refazer quando quiser.
          </Nota>
        </Cartao>

        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            variante="secundario"
            onClick={() => {
              setResultado(null)
              setTentativaId(null)
              setIndice(0)
              setEscolha(null)
              setCodigo('')
              setExecucao(null)
              setFeedbackAlternativa(null)
              setFeedbackPratica(null)
            }}
          >
            Refazer
          </Botao>
        </div>
      </div>
    )
  }

  // --- Antes de comecar ------------------------------------------------------
  if (!tentativaId) {
    return (
      <Cartao className="space-y-3">
        <div className="space-y-1">
          <p className="text-ink text-sm">
            {questoes.length} {formato === 'pratica' ? 'tarefas' : 'questões'}. Uma resposta por item, sem
            voltar atrás.
          </p>
          <p className="text-ink-muted text-sm">
            Aqui não há solução pronta. O objetivo é descobrir se você consegue usar o que estudou.
          </p>
        </div>

        {erro ? (
          <p role="alert" className="text-danger-ink text-sm">
            {erro}
          </p>
        ) : null}

        <Botao type="button" variante="primario" onClick={iniciar} disabled={ocupado}>
          {ocupado ? 'Abrindo…' : 'Começar'}
        </Botao>
      </Cartao>
    )
  }

  if (!questao) return null

  // --- Questao atual ---------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-ink-faint text-xs uppercase tracking-wide">
            {indice + 1} de {questoes.length}
          </p>
          <Selo>{questao.kind}</Selo>
        </div>
        <Progresso valor={((indice + (respondida ? 1 : 0)) / questoes.length) * 100} mostrarNumero={false} />
      </div>

      <Cartao className="space-y-4">
        <p className="text-ink leading-relaxed whitespace-pre-line">{renderizarInline(questao.prompt)}</p>

        {questao.code ? <BlocoCodigo codigo={questao.code.code} linguagem={questao.code.language} /> : null}

        {questao.kind !== 'pratica' && questao.choices ? (
          <ul className="space-y-1.5">
            {questao.choices.map((alternativa, posicao) => {
              const selecionada = escolha === posicao
              const correta = feedbackAlternativa?.indiceCorreto === posicao

              let estilo = 'border-line bg-surface hover:border-line-strong'
              if (respondida && correta) estilo = 'border-ok/50 bg-ok-soft'
              else if (respondida && selecionada) estilo = 'border-danger/50 bg-danger-soft'
              else if (respondida) estilo = 'border-line bg-surface opacity-70'
              else if (selecionada) estilo = 'border-accent bg-accent-soft'

              return (
                <li key={posicao}>
                  <button
                    type="button"
                    disabled={respondida}
                    onClick={() => setEscolha(posicao)}
                    aria-pressed={selecionada}
                    className={juntar(
                      'flex w-full items-start gap-2.5 rounded border px-3 py-2.5 text-left text-sm transition',
                      estilo,
                    )}
                  >
                    <span className="text-ink-faint mt-px font-mono text-xs">
                      {String.fromCharCode(65 + posicao)}
                    </span>
                    <span className="text-ink min-w-0 flex-1">{renderizarInline(alternativa)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {questao.kind === 'pratica' ? (
          <div className="space-y-3">
            <EditorCodigo
              rotulo="Sua solução"
              valor={codigo}
              aoMudar={setCodigo}
              linguagem={questao.language ?? 'javascript'}
              somenteLeitura={respondida}
              altura={260}
              tamanhoFonte={tamanhoFonte}
            />

            {!respondida ? (
              <div className="flex flex-wrap gap-2">
                <Botao type="button" variante="secundario" onClick={executar} disabled={ocupado}>
                  {ocupado ? 'Executando…' : 'Executar testes'}
                </Botao>

                {(questao.hints?.length ?? 0) > dicasAbertas ? (
                  <Botao type="button" variante="discreto" onClick={() => setDicasAbertas((n) => n + 1)}>
                    Ver uma dica ({dicasAbertas} usada{dicasAbertas === 1 ? '' : 's'})
                  </Botao>
                ) : null}
              </div>
            ) : null}

            {dicasAbertas > 0 ? (
              <div className="space-y-2">
                {(questao.hints ?? []).slice(0, dicasAbertas).map((dica, posicao) => (
                  <Nota key={posicao} titulo={`Dica ${posicao + 1}`}>
                    {renderizarInline(dica)}
                  </Nota>
                ))}
              </div>
            ) : null}

            {execucao ? (
              <div className="border-line overflow-hidden rounded border">
                <div className="border-line bg-surface-sunken flex items-center justify-between border-b px-3 py-2">
                  <span className="text-ink text-sm font-medium">Testes</span>
                  <span className="text-ink-muted text-sm tabular-nums">
                    {execucao.passedCount} de {execucao.totalCount}
                  </span>
                </div>
                <ul className="divide-line divide-y">
                  {execucao.cases.map((caso, posicao) => (
                    <li key={posicao} className="flex items-start gap-2 px-3 py-2 text-sm">
                      <span
                        className={juntar(
                          'font-mono text-xs font-semibold',
                          caso.passed ? 'text-ok-ink' : 'text-danger-ink',
                        )}
                      >
                        {caso.passed ? '[OK]' : '[ERRO]'}
                      </span>
                      <span className="text-ink min-w-0 flex-1">{caso.name}</span>
                    </li>
                  ))}
                </ul>
                {execucao.error ? (
                  <p className="text-danger-ink border-line border-t px-3 py-2 font-mono text-xs break-words">
                    {execucao.error}
                  </p>
                ) : null}
                {!execucao.passed ? (
                  <p className="text-ink-muted border-line border-t px-3 py-2 text-xs">
                    Ainda falta algo. Veja o que precisa ser investigado antes de enviar.
                  </p>
                ) : null}
              </div>
            ) : null}

            {questao.criteria && questao.criteria.length > 0 ? (
              <div className="space-y-1">
                <p className="text-ink-faint text-xs uppercase tracking-wide">Critérios</p>
                <ul className="text-ink-muted list-disc space-y-0.5 pl-5 text-sm">
                  {questao.criteria.map((criterio) => (
                    <li key={criterio}>{criterio}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="text-danger-ink text-sm">
            {erro}
          </p>
        ) : null}

        {feedbackAlternativa ? (
          <div
            className={juntar(
              'rounded border p-3 text-sm',
              feedbackAlternativa.correta
                ? 'border-ok/40 bg-ok-soft text-ok-ink'
                : 'border-line bg-surface-sunken text-ink',
            )}
          >
            <p className="font-medium">
              {feedbackAlternativa.correta
                ? 'Correto.'
                : `A alternativa correta é ${String.fromCharCode(65 + feedbackAlternativa.indiceCorreto)}.`}
            </p>
            <p className="mt-1 leading-relaxed">{renderizarInline(feedbackAlternativa.explicacao)}</p>
            {feedbackAlternativa.porQueNao ? (
              <p className="mt-2 leading-relaxed">
                <span className="text-ink-faint">Sobre a sua escolha: </span>
                {renderizarInline(feedbackAlternativa.porQueNao)}
              </p>
            ) : null}
          </div>
        ) : null}

        {feedbackPratica ? (
          <div className="border-line bg-surface-sunken space-y-2 rounded border p-3 text-sm">
            <p className="text-ink font-medium">
              {feedbackPratica.correta ? 'Solução aceita.' : 'A solução ainda não atende os critérios.'}
            </p>

            {feedbackPratica.verificacoesEstruturais.length > 0 ? (
              <ul className="space-y-1">
                {feedbackPratica.verificacoesEstruturais.map((verificacao) => (
                  <li key={verificacao.nome} className="flex items-start gap-2">
                    <span
                      className={juntar(
                        'font-mono text-xs font-semibold',
                        verificacao.passou ? 'text-ok-ink' : 'text-danger-ink',
                      )}
                    >
                      {verificacao.passou ? '[OK]' : '[ERRO]'}
                    </span>
                    <span className="text-ink min-w-0">
                      {verificacao.nome}
                      {verificacao.mensagem ? (
                        <span className="text-ink-muted block text-xs">{verificacao.mensagem}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-ink-faint text-xs">
              Os testes foram executados no seu navegador. As verificações estruturais foram refeitas no
              servidor.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!respondida ? (
            <Botao
              type="button"
              variante="primario"
              onClick={responder}
              disabled={ocupado || (questao.kind !== 'pratica' ? escolha === null : codigo.trim().length === 0)}
            >
              {ocupado ? 'Enviando…' : 'Responder'}
            </Botao>
          ) : (
            <Botao type="button" variante="primario" onClick={avancar} disabled={ocupado}>
              {ultima ? 'Ver resultado' : 'Próxima'}
            </Botao>
          )}
        </div>
      </Cartao>
    </div>
  )
}
