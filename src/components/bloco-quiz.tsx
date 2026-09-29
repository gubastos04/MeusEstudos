'use client'

import { useState } from 'react'

import { renderizarInline } from './texto-inline'
import { juntar } from './ui'

/**
 * Checkpoint dentro da aula.
 *
 * E exercicio, nao prova: responde na hora, mostra o porque e permite tentar de
 * novo. Nada e registrado como nota. O feedback explica o raciocinio, sem
 * elogio ("Resposta correta! Voce e otimo" nao existe aqui).
 */

export function BlocoQuiz({
  pergunta,
  alternativas,
  indiceCorreto,
  explicacao,
}: {
  pergunta: string
  alternativas: string[]
  indiceCorreto: number
  explicacao: string
}) {
  const [escolhido, setEscolhido] = useState<number | null>(null)
  const respondido = escolhido !== null
  const acertou = escolhido === indiceCorreto

  return (
    <div className="border-line bg-surface-raised space-y-3 rounded-lg border p-4">
      <p className="text-ink text-sm font-medium">{renderizarInline(pergunta)}</p>

      <ul className="space-y-1.5">
        {alternativas.map((alternativa, indice) => {
          const escolhida = escolhido === indice
          const correta = indice === indiceCorreto

          let estilo = 'border-line bg-surface hover:border-line-strong'
          if (respondido && correta) estilo = 'border-ok/50 bg-ok-soft'
          else if (respondido && escolhida) estilo = 'border-danger/50 bg-danger-soft'
          else if (respondido) estilo = 'border-line bg-surface opacity-70'

          return (
            <li key={indice}>
              <button
                type="button"
                onClick={() => setEscolhido(indice)}
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
                {respondido && correta ? (
                  <span className="text-ok-ink text-xs font-medium whitespace-nowrap">correta</span>
                ) : null}
                {respondido && escolhida && !correta ? (
                  <span className="text-danger-ink text-xs font-medium whitespace-nowrap">sua resposta</span>
                ) : null}
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
            {acertou ? 'Correto.' : `A alternativa correta é ${String.fromCharCode(65 + indiceCorreto)}.`}
          </p>
          <p className="mt-1">{renderizarInline(explicacao)}</p>
          {!acertou ? (
            <button
              type="button"
              onClick={() => setEscolhido(null)}
              className="text-accent-ink mt-2 text-xs font-medium underline underline-offset-2"
            >
              Tentar de novo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
