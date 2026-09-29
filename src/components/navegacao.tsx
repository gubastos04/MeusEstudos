'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { juntar } from './ui'

/**
 * Navegacao.
 *
 * Celular: barra inferior com 5 destinos principais, alcancaveis com o polegar.
 * Desktop: coluna lateral com a lista completa.
 *
 * A IA nao aparece aqui: ela e ferramenta contextual dentro das telas, nao uma
 * secao para visitar.
 */

type Destino = {
  href: string
  rotulo: string
  /** Abreviacao usada na barra inferior, onde o espaco e curto. */
  curto?: string
  icone: React.ReactNode
  /** Aparece na barra inferior do celular. */
  principal?: boolean
}

const traco = 'h-5 w-5'

const destinos: Destino[] = [
  {
    href: '/inicio',
    rotulo: 'Início',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V8.5Z" strokeLinejoin="round" />
      </svg>
    ),
    principal: true,
  },
  {
    href: '/estudar',
    rotulo: 'Estudar',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M3 4.5h5a2 2 0 0 1 2 2v9a1.5 1.5 0 0 0-1.5-1.5H3V4.5Z" strokeLinejoin="round" />
        <path d="M17 4.5h-5a2 2 0 0 0-2 2v9a1.5 1.5 0 0 1 1.5-1.5H17V4.5Z" strokeLinejoin="round" />
      </svg>
    ),
    principal: true,
  },
  {
    href: '/demandas',
    rotulo: 'Demandas',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3.5" y="3" width="13" height="14" rx="2" />
        <path d="M7 8h6M7 11.5h4" strokeLinecap="round" />
      </svg>
    ),
    principal: true,
  },
  {
    href: '/projetos',
    rotulo: 'Projetos',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H8l1.5 2h6A1.5 1.5 0 0 1 17 8.5v5A1.5 1.5 0 0 1 15.5 15h-11A1.5 1.5 0 0 1 3 13.5v-7Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/desafios',
    rotulo: 'Desafios',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="m10 3 2.2 4.5 5 .7-3.6 3.5.85 4.9L10 14.3l-4.45 2.3.85-4.9L2.8 8.2l5-.7L10 3Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/erros',
    rotulo: 'Meus erros',
    curto: 'Erros',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M10 6.5v4M10 13.2v.3" strokeLinecap="round" />
      </svg>
    ),
    principal: true,
  },
  {
    href: '/anotacoes',
    rotulo: 'Anotações',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M5 3.5h10v13l-5-2.5-5 2.5v-13Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/glossario',
    rotulo: 'Glossário',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.2 13.2 3.3 3.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/leitura-offline',
    rotulo: 'Leitura offline',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M10 3v8m0 0 3-3m-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 13v2.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V13" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/progresso',
    rotulo: 'Progresso',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 16V9M10 16V4M16 16v-5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/perfil',
    rotulo: 'Perfil',
    icone: (
      <svg className={traco} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="10" cy="7" r="3" />
        <path d="M4 17c0-2.8 2.7-4.5 6-4.5s6 1.7 6 4.5" strokeLinecap="round" />
      </svg>
    ),
    principal: true,
  },
]

function ativo(pathname: string, href: string): boolean {
  if (href === '/inicio') return pathname === '/inicio'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BarraInferior() {
  const pathname = usePathname()
  const principais = destinos.filter((destino) => destino.principal)

  return (
    <nav
      aria-label="Navegação principal"
      className="border-line bg-surface-raised/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {principais.map((destino) => {
          const selecionado = ativo(pathname, destino.href)
          return (
            <li key={destino.href}>
              <Link
                href={destino.href}
                aria-current={selecionado ? 'page' : undefined}
                className={juntar(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition',
                  selecionado ? 'text-accent font-medium' : 'text-ink-muted',
                )}
              >
                {destino.icone}
                <span>{destino.curto ?? destino.rotulo}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function ColunaLateral({ nome }: { nome: string }) {
  const pathname = usePathname()

  return (
    <aside className="border-line hidden w-56 shrink-0 border-r md:block">
      <div className="sticky top-0 flex h-screen flex-col gap-4 p-4">
        <Link href="/inicio" className="flex flex-col gap-0.5">
          <span className="text-ink text-base font-semibold tracking-tight">Meus Estudos</span>
          <span className="text-ink-faint text-xs">{nome}</span>
        </Link>

        <nav aria-label="Navegação principal" className="flex-1">
          <ul className="space-y-0.5">
            {destinos.map((destino) => {
              const selecionado = ativo(pathname, destino.href)
              return (
                <li key={destino.href}>
                  <Link
                    href={destino.href}
                    aria-current={selecionado ? 'page' : undefined}
                    className={juntar(
                      'flex min-h-10 items-center gap-2.5 rounded px-2.5 text-sm transition',
                      selecionado
                        ? 'bg-accent-soft text-accent-ink font-medium'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    {destino.icone}
                    <span>{destino.rotulo}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <p className="text-ink-faint text-xs leading-relaxed">
          O número que importa não é a sequência perfeita. É o total que não volta pra trás.
        </p>
      </div>
    </aside>
  )
}

/** Cabecalho do celular: identifica a tela sem ocupar espaco. */
export function CabecalhoMobile({ titulo }: { titulo: string }) {
  return (
    <header className="border-line bg-surface/95 sticky top-0 z-30 border-b backdrop-blur md:hidden">
      <div className="flex min-h-12 items-center px-4">
        <span className="text-ink text-sm font-semibold">{titulo}</span>
      </div>
    </header>
  )
}
