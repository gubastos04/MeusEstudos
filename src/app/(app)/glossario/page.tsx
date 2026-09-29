import type { Metadata } from 'next'

import { requireOnboardedUser } from '@/lib/auth'
import { getGlossary } from '@/lib/content/loader'
import { BuscaGlossario } from '@/components/busca-glossario'
import { Titulo } from '@/components/ui'

export const metadata: Metadata = { title: 'Glossário' }

export default async function PaginaGlossario() {
  await requireOnboardedUser()

  const termos = getGlossary().map((termo) => ({
    id: termo.id,
    term: termo.term,
    short: termo.short,
    explanation: termo.explanation,
    example: termo.example ?? null,
    whereItAppears: termo.whereItAppears,
    related: termo.related,
    tags: termo.tags,
  }))

  return (
    <div className="space-y-6">
      <Titulo sub="O vocabulário que aparece em reunião, em code review e em documentação.">Glossário</Titulo>

      <BuscaGlossario termos={termos} />
    </div>
  )
}
