import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Primitivos do design system.
 *
 * Todos sao Server Components por padrao (nenhum usa estado).
 * Regras aplicadas aqui:
 * - `danger` somente para erro real, risco e falha de validacao;
 * - nenhum estado depende apenas de cor: sempre ha texto;
 * - alvo de toque minimo confortavel no celular.
 */

function juntar(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// --- Botao -------------------------------------------------------------------

type Variante = 'primario' | 'secundario' | 'discreto' | 'perigo'

const variantes: Record<Variante, string> = {
  primario: 'bg-accent text-ink-inverse hover:bg-accent-hover border-transparent',
  secundario: 'bg-surface-raised text-ink border-line-control hover:bg-surface-sunken',
  discreto: 'bg-transparent text-ink-muted border-transparent hover:bg-surface-sunken hover:text-ink',
  perigo: 'bg-transparent text-danger border-danger/40 hover:bg-danger-soft',
}

// 44px de altura, sem excecao. Existia um tamanho `sm` de 36px que quebrava o
// minimo de toque justamente nos botoes mais usados no celular; ele diferia do
// padrao so na folga horizontal, o que nao pagava o custo.
const tamanhoUnico = 'min-h-11 px-4 text-sm'

type BotaoProps = {
  variante?: Variante
  larguraTotal?: boolean
} & ComponentProps<'button'>

export function Botao({
  variante = 'secundario',
  larguraTotal = false,
  className,
  ...props
}: BotaoProps) {
  return (
    <button
      {...props}
      className={juntar(
        'inline-flex items-center justify-center gap-2 rounded border font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variantes[variante],
        tamanhoUnico,
        larguraTotal && 'w-full',
        className,
      )}
    />
  )
}

type BotaoLinkProps = {
  variante?: Variante
  larguraTotal?: boolean
} & ComponentProps<typeof Link>

export function BotaoLink({
  variante = 'secundario',
  larguraTotal = false,
  className,
  ...props
}: BotaoLinkProps) {
  return (
    <Link
      {...props}
      className={juntar(
        'inline-flex items-center justify-center gap-2 rounded border font-medium transition',
        variantes[variante],
        tamanhoUnico,
        larguraTotal && 'w-full',
        className,
      )}
    />
  )
}

// --- Superficies -------------------------------------------------------------

export function Cartao({
  children,
  className,
  as: Componente = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'li'
}) {
  return (
    <Componente className={juntar('bg-surface-raised border-line rounded-lg border p-4', className)}>
      {children}
    </Componente>
  )
}

export function Secao({
  titulo,
  descricao,
  acao,
  children,
  className,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={juntar('space-y-3', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg">{titulo}</h2>
          {descricao ? <p className="text-ink-muted text-sm">{descricao}</p> : null}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

// --- Selos e rotulos ---------------------------------------------------------

type TomSelo = 'neutro' | 'accent' | 'ok' | 'warn' | 'danger'

const tonsSelo: Record<TomSelo, string> = {
  neutro: 'bg-surface-sunken text-ink-muted border-line',
  accent: 'bg-accent-soft text-accent-ink border-accent/30',
  ok: 'bg-ok-soft text-ok-ink border-ok/30',
  warn: 'bg-warn-soft text-warn-ink border-warn/30',
  danger: 'bg-danger-soft text-danger-ink border-danger/30',
}

export function Selo({
  children,
  tom = 'neutro',
  className,
}: {
  children: ReactNode
  tom?: TomSelo
  className?: string
}) {
  return (
    <span
      className={juntar(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tonsSelo[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Metrica informativa. Informa, nao premia: sem cor de recompensa. */
export function Metrica({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string
  valor: string | number
  detalhe?: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-ink-faint text-xs uppercase tracking-wide">{rotulo}</p>
      <p className="text-ink text-xl font-semibold tabular-nums">{valor}</p>
      {detalhe ? <p className="text-ink-muted text-xs">{detalhe}</p> : null}
    </div>
  )
}

export function Progresso({
  valor,
  rotulo,
  mostrarNumero = true,
}: {
  valor: number
  rotulo?: string
  mostrarNumero?: boolean
}) {
  const percentual = Math.max(0, Math.min(100, Math.round(valor)))

  return (
    <div className="space-y-1.5">
      {(rotulo || mostrarNumero) && (
        <div className="flex items-baseline justify-between gap-2 text-sm">
          {rotulo ? <span className="text-ink">{rotulo}</span> : <span />}
          {mostrarNumero ? <span className="text-ink-muted tabular-nums">{percentual}%</span> : null}
        </div>
      )}
      <div
        className="trilho"
        role="progressbar"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo ? `Progresso de ${rotulo}` : 'Progresso'}
      >
        <span style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

// --- Estados do sistema ------------------------------------------------------

/**
 * Estado vazio. Diz o que nao existe e o que fazer.
 * Nunca usa vermelho: lista sem resultado e informacao, nao falha.
 */
export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="border-line bg-surface-raised rounded-lg border border-dashed p-6 text-center">
      <p className="text-ink font-medium">{titulo}</p>
      {descricao ? <p className="text-ink-muted mx-auto mt-1 max-w-md text-sm">{descricao}</p> : null}
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  )
}

/** Erro tecnico. Este e o lugar do vermelho. */
export function ErroTecnico({
  titulo = 'Algo deu errado',
  descricao,
  acao,
}: {
  titulo?: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div
      role="alert"
      className="border-danger/40 bg-danger-soft text-danger-ink rounded-lg border p-4 text-sm"
    >
      <p className="font-medium">{titulo}</p>
      {descricao ? <p className="mt-1">{descricao}</p> : null}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  )
}

/** Aviso. Atencao tecnica, sem ser erro. */
export function Aviso({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <div className="border-warn/40 bg-warn-soft text-warn-ink rounded-lg border p-4 text-sm">
      {titulo ? <p className="font-medium">{titulo}</p> : null}
      <div className={titulo ? 'mt-1' : undefined}>{children}</div>
    </div>
  )
}

/** Nota informativa, tom neutro. */
export function Nota({ children, titulo }: { children: ReactNode; titulo?: string }) {
  return (
    <div className="border-line bg-surface-sunken text-ink-muted rounded-lg border p-4 text-sm">
      {titulo ? <p className="text-ink font-medium">{titulo}</p> : null}
      <div className={titulo ? 'mt-1' : undefined}>{children}</div>
    </div>
  )
}

export function Carregando({ linhas = 3, className }: { linhas?: number; className?: string }) {
  return (
    <div className={juntar('space-y-2', className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando</span>
      {Array.from({ length: linhas }).map((_, indice) => (
        <div key={indice} className="esqueleto h-4" style={{ width: `${100 - indice * 12}%` }} />
      ))}
    </div>
  )
}

// --- Texto -------------------------------------------------------------------

export function Titulo({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl">{children}</h1>
      {sub ? <p className="text-ink-muted text-sm">{sub}</p> : null}
    </div>
  )
}

export function Dica({ children }: { children: ReactNode }) {
  return <p className="text-ink-faint text-xs">{children}</p>
}

/** Lista de definicao compacta, usada em detalhes de demanda e projeto. */
export function Definicoes({ itens }: { itens: { termo: string; valor: ReactNode }[] }) {
  return (
    <dl className="divide-line divide-y text-sm">
      {itens.map((item) => (
        <div key={item.termo} className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[10rem_1fr] sm:gap-3">
          <dt className="text-ink-faint">{item.termo}</dt>
          <dd className="text-ink">{item.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

export { juntar }
