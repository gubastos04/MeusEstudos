import type { ContentBlock } from '@/lib/content/schema'
import { BlocoCodigo, BlocoTerminal } from './bloco-codigo'
import { BlocoQuiz } from './bloco-quiz'
import { renderizarInline } from './texto-inline'

/**
 * Renderiza os blocos de uma aula.
 *
 * Server Component: so os blocos que precisam de estado (codigo, com botao de
 * copiar, e quiz) sao client. Isso mantem o JavaScript enviado ao celular baixo.
 */

const tonsCallout = {
  info: 'border-line bg-surface-sunken text-ink',
  warn: 'border-warn/40 bg-warn-soft text-warn-ink',
  // `danger` so aparece quando o conteudo fala de risco tecnico real.
  danger: 'border-danger/40 bg-danger-soft text-danger-ink',
} as const

export function Blocos({ blocos }: { blocos: ContentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocos.map((bloco, indice) => (
        <Bloco key={indice} bloco={bloco} />
      ))}
    </div>
  )
}

function Bloco({ bloco }: { bloco: ContentBlock }) {
  switch (bloco.kind) {
    case 'text':
      return <p className="text-ink leading-relaxed">{renderizarInline(bloco.text)}</p>

    case 'code':
      return (
        <BlocoCodigo
          codigo={bloco.code}
          linguagem={bloco.language}
          legenda={bloco.caption}
          destaque={bloco.highlight}
        />
      )

    case 'terminal':
      return <BlocoTerminal linhas={bloco.lines} legenda={bloco.caption} />

    case 'list': {
      const Lista = bloco.ordered ? 'ol' : 'ul'
      return (
        <Lista
          className={
            bloco.ordered
              ? 'text-ink marker:text-ink-faint list-decimal space-y-1.5 pl-5'
              : 'text-ink marker:text-ink-faint list-disc space-y-1.5 pl-5'
          }
        >
          {bloco.items.map((item, indice) => (
            <li key={indice} className="leading-relaxed">
              {renderizarInline(item)}
            </li>
          ))}
        </Lista>
      )
    }

    case 'callout':
      return (
        <aside className={`rounded-lg border p-4 text-sm ${tonsCallout[bloco.tone]}`}>
          {bloco.title ? <p className="font-semibold">{bloco.title}</p> : null}
          <p className={bloco.title ? 'mt-1 leading-relaxed' : 'leading-relaxed'}>
            {renderizarInline(bloco.text)}
          </p>
        </aside>
      )

    case 'table':
      return (
        <figure className="border-line overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead className="bg-surface-sunken">
                <tr>
                  {bloco.headers.map((cabecalho) => (
                    <th
                      key={cabecalho}
                      scope="col"
                      className="text-ink border-line border-b px-3 py-2 text-left font-medium"
                    >
                      {cabecalho}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloco.rows.map((linha, indice) => (
                  <tr key={indice} className="border-line border-b last:border-b-0">
                    {linha.map((celula, coluna) => (
                      <td key={coluna} className="text-ink px-3 py-2 align-top">
                        {renderizarInline(celula)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bloco.caption ? (
            <figcaption className="border-line text-ink-muted border-t px-3 py-2 text-xs">
              {bloco.caption}
            </figcaption>
          ) : null}
        </figure>
      )

    case 'quiz':
      return (
        <BlocoQuiz
          pergunta={bloco.question}
          alternativas={bloco.choices}
          indiceCorreto={bloco.answerIndex}
          explicacao={bloco.explanation}
        />
      )
  }
}
