import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { getTracks } from '@/lib/content/loader'
import { InicioRapido } from '@/components/inicio-rapido'

export const metadata: Metadata = { title: 'Começar' }

export default async function PaginaComecar() {
  const usuario = await requireUser()
  if (usuario.onboardedAt) redirect('/inicio')

  const trilhas = getTracks().map((trilha) => ({
    id: trilha.id,
    title: trilha.title,
    summary: trilha.summary,
    forWho: trilha.forWho,
  }))

  return (
    <main id="conteudo" className="mx-auto w-full max-w-xl px-4 py-8 md:py-14">
      <div className="mb-8 space-y-2">
        <h1 className="text-2xl">Antes de começar</h1>
        <p className="text-ink-muted text-sm">
          Quatro passos rápidos para montar um caminho inicial. Nenhuma resposta é definitiva.
        </p>
      </div>

      <InicioRapido trilhas={trilhas} />
    </main>
  )
}
