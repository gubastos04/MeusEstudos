import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { getChallenges } from '@/lib/content/loader'
import { getProgressMap, progressOf } from '@/lib/progress'
import { Nota, Selo, Titulo, juntar } from '@/components/ui'

export const metadata: Metadata = { title: 'Desafios' }

export default async function PaginaDesafios() {
  const usuario = await requireOnboardedUser()

  const desafios = getChallenges()
  const progresso = await getProgressMap(usuario.id, 'challenge')

  const categorias = [...new Set(desafios.map((desafio) => desafio.category))].sort()

  return (
    <div className="space-y-6">
      <Titulo sub="Problemas fechados, com contexto e critérios. Sem pontuação e sem ranking.">Desafios</Titulo>

      <Nota>
        Cada desafio tem contexto, objetivo, restrições e critérios de aceitação. A solução aparece quando
        você pedir — e só faz sentido depois de tentar.
      </Nota>

      {categorias.map((categoria) => (
        <section key={categoria} className="space-y-2">
          <h2 className="text-ink-faint text-xs font-medium uppercase tracking-wide">{categoria}</h2>

          <ul className="space-y-2">
            {desafios
              .filter((desafio) => desafio.category === categoria)
              .map((desafio) => {
                const resolvido = progressOf(progresso, 'challenge', desafio.id)?.status === 'completed'

                return (
                  <li key={desafio.id}>
                    <Link
                      href={`/desafios/${desafio.id}`}
                      className={juntar(
                        'border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-4 transition',
                        resolvido && 'opacity-85',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Selo>{desafio.difficulty}</Selo>
                        <Selo>~{desafio.estimatedMinutes} min</Selo>
                        <Selo>{desafio.language}</Selo>
                        {resolvido ? <Selo tom="ok">resolvido</Selo> : null}
                      </div>

                      <h3 className="text-ink mt-2 text-base font-semibold">{desafio.title}</h3>
                      <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{desafio.objective}</p>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </div>
  )
}
