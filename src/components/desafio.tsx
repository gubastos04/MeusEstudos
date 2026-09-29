'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import type { StructuralCheck, TestCase } from '@/lib/content/schema'
import { capabilityFor, runExercise, type RunOutcome } from '@/lib/runner'
import { EditorCodigo } from './editor-codigo'
import { renderizarInline } from './texto-inline'
import { Aviso, Botao, Cartao, Nota, juntar } from './ui'

/**
 * Resolucao de um desafio.
 *
 * Desafio fica entre exercicio e avaliacao: dicas existem, a solucao existe,
 * mas so depois de tentar. Sem pontos, sem ranking e sem tempo cronometrado —
 * a comparacao aqui e com o proprio raciocinio, nao com outras pessoas.
 */

export function Desafio({
  desafioId,
  linguagem,
  inicial,
  testes,
  verificacoes,
  dicas,
  solucao,
  notasDaSolucao,
  concluido,
  tamanhoFonte = 14,
}: {
  desafioId: string
  linguagem: string
  inicial: string
  testes: TestCase[]
  verificacoes: StructuralCheck[]
  dicas: string[]
  solucao?: string
  notasDaSolucao?: string
  concluido: boolean
  tamanhoFonte?: number
}) {
  const router = useRouter()
  const [codigo, setCodigo] = useState(inicial)
  const [resultado, setResultado] = useState<RunOutcome | null>(null)
  const [rodando, setRodando] = useState(false)
  const [dicasAbertas, setDicasAbertas] = useState(0)
  const [solucaoVisivel, setSolucaoVisivel] = useState(false)
  const [permitiuPython, setPermitiuPython] = useState(false)
  const [marcado, setMarcado] = useState(concluido)

  const capacidade = capabilityFor(linguagem, testes)
  const precisaAutorizar = capacidade === 'execucao-sob-demanda' && !permitiuPython

  async function executar() {
    if (rodando) return
    setRodando(true)

    const saida = await runExercise({
      code: codigo,
      language: linguagem,
      tests: testes,
      checks: verificacoes,
      allowHeavyRuntime: permitiuPython,
    })

    setResultado(saida)
    setRodando(false)

    if (saida.passed && !marcado) {
      await enviar('/api/progresso', { acao: 'concluir', tipo: 'challenge', id: desafioId })
      setMarcado(true)
      router.refresh()
    }
  }

  async function marcarManualmente() {
    if (marcado) return
    await enviar('/api/progresso', { acao: 'concluir', tipo: 'challenge', id: desafioId })
    setMarcado(true)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {capacidade === 'estrutura' ? (
        <Nota titulo="Como este desafio é verificado">
          A plataforma lê o seu código procurando os pontos-chave. Isso não prova que ele funciona — é um
          roteiro de conferência.
        </Nota>
      ) : null}

      <EditorCodigo
        rotulo="Sua solução"
        valor={codigo}
        aoMudar={setCodigo}
        linguagem={linguagem}
        altura={300}
        tamanhoFonte={tamanhoFonte}
      />

      {precisaAutorizar ? (
        <Aviso titulo="Rodar Python aqui precisa de um download">
          <p>O interpretador roda no navegador e tem alguns megabytes. Em rede móvel, vale esperar o wi-fi.</p>
          <Botao
            type="button"
            variante="secundario"
            className="mt-3"
            onClick={() => setPermitiuPython(true)}
          >
            Baixar e executar
          </Botao>
        </Aviso>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Botao type="button" variante="primario" onClick={executar} disabled={rodando || precisaAutorizar}>
          {rodando ? 'Executando…' : testes.length > 0 ? 'Executar testes' : 'Verificar'}
        </Botao>

        <Botao
          type="button"
          variante="discreto"
          onClick={() => {
            setCodigo(inicial)
            setResultado(null)
          }}
        >
          Recomeçar
        </Botao>

        {dicas.length > dicasAbertas ? (
          <Botao type="button" variante="secundario" onClick={() => setDicasAbertas((n) => n + 1)}>
            {dicasAbertas === 0 ? 'Ver uma dica' : 'Próxima dica'}
          </Botao>
        ) : null}

        {solucao ? (
          <Botao type="button" variante="discreto" onClick={() => setSolucaoVisivel((v) => !v)}>
            {solucaoVisivel ? 'Esconder solução' : 'Ver solução'}
          </Botao>
        ) : null}

        {!marcado ? (
          <Botao type="button" variante="discreto" onClick={marcarManualmente}>
            Marcar como resolvido
          </Botao>
        ) : null}
      </div>

      {marcado ? <p className="text-ok-ink text-sm">Desafio marcado como resolvido.</p> : null}

      {dicasAbertas > 0 ? (
        <div className="space-y-2">
          {dicas.slice(0, dicasAbertas).map((dica, indice) => (
            <Nota key={indice} titulo={`Dica ${indice + 1}`}>
              {renderizarInline(dica)}
            </Nota>
          ))}
        </div>
      ) : null}

      {resultado ? (
        <Cartao className="space-y-2" aria-live="polite">
          {resultado.error ? (
            <div className="border-danger/40 bg-danger-soft text-danger-ink rounded border p-3 text-sm">
              <p className="font-medium">O código não chegou a rodar</p>
              <p className="mt-1 font-mono text-xs break-words">{resultado.error}</p>
            </div>
          ) : null}

          {resultado.cases.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-ink text-sm font-medium">Resultado</p>
                <p
                  className={juntar(
                    'text-sm tabular-nums',
                    resultado.passed ? 'text-ok-ink' : 'text-ink-muted',
                  )}
                >
                  {resultado.passedCount} de {resultado.totalCount}
                </p>
              </div>

              <ul className="space-y-1">
                {resultado.cases.map((caso, indice) => (
                  <li key={indice} className="flex items-start gap-2 text-sm">
                    <span
                      className={juntar(
                        'font-mono text-xs font-semibold',
                        caso.passed ? 'text-ok-ink' : 'text-danger-ink',
                      )}
                    >
                      {caso.passed ? '[OK]' : '[ERRO]'}
                    </span>
                    <span className="text-ink min-w-0 flex-1">
                      {caso.name}
                      {!caso.passed && caso.message ? (
                        <span className="text-danger-ink block font-mono text-xs break-words">
                          {caso.message}
                        </span>
                      ) : null}
                      {!caso.passed && !caso.message && caso.expected !== undefined ? (
                        <span className="text-ink-muted block font-mono text-xs break-words">
                          esperado {caso.expected} · recebido {caso.received ?? '—'}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {resultado.output.length > 0 ? (
            <details>
              <summary className="text-ink-muted cursor-pointer text-sm">Saída do console</summary>
              <pre className="text-ink mt-2 overflow-x-auto text-xs leading-relaxed">
                <code>{resultado.output.join('\n')}</code>
              </pre>
            </details>
          ) : null}
        </Cartao>
      ) : null}

      {solucaoVisivel && solucao ? (
        <div className="space-y-2">
          <EditorCodigo
            rotulo="Uma solução possível"
            valor={solucao}
            aoMudar={() => undefined}
            linguagem={linguagem}
            somenteLeitura
            altura={260}
            tamanhoFonte={tamanhoFonte}
          />
          {notasDaSolucao ? <Nota titulo="Sobre esta solução">{renderizarInline(notasDaSolucao)}</Nota> : null}
        </div>
      ) : null}
    </div>
  )
}
