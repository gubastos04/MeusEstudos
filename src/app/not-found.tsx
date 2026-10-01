import Link from 'next/link'

export default function NaoEncontrado() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl">Essa página não existe</h1>
      <p className="text-ink-muted text-sm">
        O endereço pode ter mudado, ou o conteúdo foi removido. Nada do seu progresso foi afetado.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/inicio"
          className="bg-accent text-ink-inverse hover:bg-accent-hover inline-flex min-h-11 items-center rounded border border-transparent px-4 text-sm font-medium"
        >
          Ir para o início
        </Link>
        <Link
          href="/estudar"
          className="border-line-control bg-surface-raised text-ink hover:bg-surface-sunken inline-flex min-h-11 items-center rounded border px-4 text-sm font-medium"
        >
          Ver módulos
        </Link>
      </div>
    </main>
  )
}
