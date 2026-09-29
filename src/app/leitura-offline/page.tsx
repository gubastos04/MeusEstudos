import type { Metadata } from 'next'

import { LeitorOffline } from '@/components/leitor-offline'
import { SincronizacaoOffline } from '@/components/sincronizacao-offline'

export const metadata: Metadata = { title: 'Leitura offline' }

/**
 * Tela de leitura offline.
 *
 * E publica de proposito. Ela e a unica pagina que o service worker guarda em
 * cache, e cache de HTML sobrevive ao logout: se exigisse sessao, estaria
 * guardando tela autenticada no disco do aparelho. Aqui nao ha nada do
 * servidor — todo o conteudo vem do cache local do proprio navegador.
 */

type Props = { searchParams: Promise<{ modulo?: string; item?: string; caminho?: string }> }

export default async function PaginaLeituraOffline({ searchParams }: Props) {
  const { modulo, item, caminho } = await searchParams

  // O service worker manda o caminho original quando uma navegacao falha:
  // /estudar/<modulo>/<item>
  const partes = caminho?.split('/').filter(Boolean) ?? []
  const doCaminho =
    partes[0] === 'estudar' ? { modulo: partes[1], item: partes[2] } : { modulo: undefined, item: undefined }

  return (
    <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <LeitorOffline
        moduloInicial={modulo ?? doCaminho.modulo}
        itemInicial={item ?? doCaminho.item}
      />

      {/*
        Tambem aqui: quem leu offline e voltou a ter rede deve ver a fila subir
        sem precisar navegar ate uma tela autenticada. Sem sessao, o envio falha
        com 401 e a fila e mantida.
      */}
      <SincronizacaoOffline />
    </main>
  )
}
