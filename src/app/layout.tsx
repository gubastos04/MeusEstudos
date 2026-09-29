import type { Metadata, Viewport } from 'next'

import { currentUser } from '@/lib/auth'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Meus Estudos',
    template: '%s · Meus Estudos',
  },
  description:
    'Plataforma de estudos práticos de programação: conteúdo curto, exercícios, demandas de empresa e projetos de portfólio.',
  applicationName: 'Meus Estudos',
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Nao bloqueia o zoom: quem precisa ampliar tem de conseguir.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#161718' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // O tema fica no perfil, entao a preferencia acompanha a pessoa entre
  // dispositivos. Sem sessao, segue o sistema.
  const usuario = await currentUser()
  const tema = usuario?.theme

  return (
    <html lang="pt-BR" data-theme={tema === 'light' || tema === 'dark' ? tema : undefined}>
      <body>
        <a
          href="#conteudo"
          className="bg-accent text-ink-inverse sr-only rounded px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  )
}
