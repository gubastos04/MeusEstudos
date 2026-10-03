'use client'

import { useState } from 'react'

import { BlocoCodigo } from './bloco-codigo'
import { renderizarInline } from './texto-inline'
import { juntar } from './ui'

/**
 * Termos do glossario citados na aula.
 *
 * Abre a definicao ali mesmo, sem sair da tela. A regra do produto e explicita:
 * o conteudo, a documentacao e o glossario ficam dentro da plataforma, para a
 * pessoa nao precisar trocar de janela no meio do estudo.
 */

export type TermoResumido = {
  id: string
  term: string
  short: string
  explanation: string
  example?: { language: string; code: string } | null
  whereItAppears: string[]
}

export function GlossarioInline({ termos }: { termos: TermoResumido[] }) {
  const [aberto, setAberto] = useState<string | null>(null)

  if (termos.length === 0) return null

  const selecionado = termos.find((termo) => termo.id === aberto) ?? null

  /**
   * O rótulo dizia "Termos que aparecem aqui", e era falso em 55% dos casos:
   * o campo `glossary` da aula é curado à mão, não derivado do texto. E deve
   * continuar sendo — o link mais útil costuma ser justo o do conceito que a
   * aula discute com outras palavras ("consulta dentro de um laço" para quem
   * ainda não sabe o que é query). Derivar por ocorrência literal perderia
   * exatamente esse caso; o que estava errado era a promessa, não o dado.
   */
  return (
    <section aria-labelledby="termos-da-aula" className="space-y-2">
      <h2 id="termos-da-aula" className="text-ink-faint text-xs font-medium uppercase tracking-wide">
        Vocabulário relacionado
      </h2>

      <ul className="flex flex-wrap gap-1.5">
        {termos.map((termo) => {
          const ativo = aberto === termo.id
          return (
            <li key={termo.id}>
              <button
                type="button"
                onClick={() => setAberto(ativo ? null : termo.id)}
                aria-expanded={ativo}
                className={juntar(
                  'min-h-9 rounded border px-2.5 text-sm transition',
                  ativo
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-raised text-ink-muted hover:text-ink',
                )}
              >
                {termo.term}
              </button>
            </li>
          )
        })}
      </ul>

      {selecionado ? (
        <div className="border-line bg-surface-sunken space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-ink font-semibold">{selecionado.term}</p>
            <p className="text-ink-muted text-sm">{selecionado.short}</p>
          </div>

          <p className="text-ink text-sm leading-relaxed">{renderizarInline(selecionado.explanation)}</p>

          {selecionado.example ? (
            <BlocoCodigo codigo={selecionado.example.code} linguagem={selecionado.example.language} />
          ) : null}

          {selecionado.whereItAppears.length > 0 ? (
            <div className="space-y-1">
              <p className="text-ink-faint text-xs uppercase tracking-wide">Onde aparece</p>
              <ul className="text-ink-muted list-disc space-y-0.5 pl-5 text-sm">
                {selecionado.whereItAppears.map((lugar) => (
                  <li key={lugar}>{lugar}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
