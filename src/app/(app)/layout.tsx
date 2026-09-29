import { requireOnboardedUser } from '@/lib/auth'
import { BarraInferior, CabecalhoMobile, ColunaLateral } from '@/components/navegacao'
import { SincronizacaoOffline } from '@/components/sincronizacao-offline'

/**
 * Casca das telas internas.
 *
 * Mobile first: no celular a navegacao fica embaixo, ao alcance do polegar, e o
 * conteudo ocupa a tela inteira. No desktop, o espaco extra vira coluna lateral.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await requireOnboardedUser()

  return (
    <div className="flex min-h-screen">
      <ColunaLateral nome={usuario.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <CabecalhoMobile titulo="Meus Estudos" />

        <main id="conteudo" className="min-w-0 flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-12 md:pt-8">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>

      <BarraInferior />
      <SincronizacaoOffline />
    </div>
  )
}
