import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDateTime } from '@/lib/dates'
import { parseStringArray } from '@/lib/json'
import { EditorAnotacao } from '@/components/editor-anotacao'
import { Selo } from '@/components/ui'

export const metadata: Metadata = { title: 'Anotação' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaAnotacao({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { id } = await params

  const anotacao = await db.note.findFirst({ where: { id, userId: usuario.id } })
  if (!anotacao) notFound()

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/anotacoes" className="text-ink-muted hover:text-ink text-sm">
          ← Anotações
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <Selo>atualizada em {formatDateTime(anotacao.updatedAt)}</Selo>
          {anotacao.pinned ? <Selo tom="accent">fixada</Selo> : null}
        </div>
      </div>

      <EditorAnotacao
        anotacao={{
          id: anotacao.id,
          titulo: anotacao.title,
          corpo: anotacao.body,
          codigo: anotacao.code,
          linguagem: anotacao.language,
          tags: parseStringArray(anotacao.tags),
          fixada: anotacao.pinned,
        }}
      />
    </div>
  )
}
