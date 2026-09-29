'use client'

import { useId } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import { juntar } from './ui'

/**
 * Campos de formulario.
 *
 * Regras do produto aplicadas aqui:
 * - rotulo sempre visivel, ligado ao campo por id;
 * - texto de ajuda antes do erro, nao depois;
 * - erro com aria-invalid, role="alert" e texto — nunca so a cor da borda;
 * - altura confortavel para toque e teclado adequado no celular.
 */

type BaseProps = {
  rotulo: string
  ajuda?: string
  erro?: string | null
  obrigatorio?: boolean
}

function Envolucro({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  id,
  children,
}: BaseProps & { id: string; children: (props: { id: string; descrito: string }) => ReactNode }) {
  const idAjuda = `${id}-ajuda`
  const idErro = `${id}-erro`
  const descrito = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ')

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {rotulo}
        {obrigatorio ? (
          <span className="text-ink-faint font-normal"> (obrigatório)</span>
        ) : (
          <span className="text-ink-faint font-normal"> (opcional)</span>
        )}
      </label>

      {ajuda ? (
        <p id={idAjuda} className="text-ink-muted text-xs">
          {ajuda}
        </p>
      ) : null}

      {children({ id, descrito })}

      {erro ? (
        <p id={idErro} role="alert" className="text-danger-ink text-xs font-medium">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

const classeCampo =
  'bg-surface-raised border-line text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base transition focus:border-accent'
const classeErro = 'border-danger'

export function Campo({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  className,
  ...props
}: BaseProps & ComponentProps<'input'>) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <Envolucro rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={obrigatorio} id={id}>
      {({ descrito }) => (
        <input
          {...props}
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          className={juntar(classeCampo, erro && classeErro, className)}
        />
      )}
    </Envolucro>
  )
}

export function CampoTexto({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  className,
  ...props
}: BaseProps & ComponentProps<'textarea'>) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <Envolucro rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={obrigatorio} id={id}>
      {({ descrito }) => (
        <textarea
          {...props}
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          className={juntar(classeCampo, 'min-h-24 resize-y leading-relaxed', erro && classeErro, className)}
        />
      )}
    </Envolucro>
  )
}

export function CampoSelecao({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  opcoes,
  className,
  ...props
}: BaseProps & { opcoes: { valor: string; rotulo: string }[] } & ComponentProps<'select'>) {
  const gerado = useId()
  const id = props.id ?? gerado

  return (
    <Envolucro rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={obrigatorio} id={id}>
      {({ descrito }) => (
        <select
          {...props}
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descrito || undefined}
          className={juntar(classeCampo, erro && classeErro, className)}
        >
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      )}
    </Envolucro>
  )
}

/** Grupo de escolha unica, em formato de cartao — bom para toque. */
export function Escolha({
  rotulo,
  ajuda,
  nome,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string
  ajuda?: string
  nome: string
  valor: string | null
  opcoes: { valor: string; rotulo: string; detalhe?: string }[]
  aoMudar: (valor: string) => void
}) {
  const id = useId()

  return (
    <fieldset className="space-y-2">
      <legend className="text-ink text-sm font-medium">{rotulo}</legend>
      {ajuda ? <p className="text-ink-muted text-xs">{ajuda}</p> : null}

      <div className="grid gap-2">
        {opcoes.map((opcao) => {
          const idOpcao = `${id}-${opcao.valor}`
          const selecionado = valor === opcao.valor

          return (
            <label
              key={opcao.valor}
              htmlFor={idOpcao}
              className={juntar(
                'flex min-h-12 cursor-pointer items-start gap-3 rounded border px-3 py-2.5 transition',
                selecionado
                  ? 'border-accent bg-accent-soft'
                  : 'border-line bg-surface-raised hover:border-line-strong',
              )}
            >
              <input
                type="radio"
                id={idOpcao}
                name={nome}
                value={opcao.valor}
                checked={selecionado}
                onChange={() => aoMudar(opcao.valor)}
                className="accent-accent mt-1"
              />
              <span className="min-w-0">
                <span className={juntar('block text-sm', selecionado ? 'text-accent-ink font-medium' : 'text-ink')}>
                  {opcao.rotulo}
                </span>
                {opcao.detalhe ? <span className="text-ink-muted block text-xs">{opcao.detalhe}</span> : null}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Marcador({
  rotulo,
  detalhe,
  marcado,
  aoMudar,
  desabilitado,
}: {
  rotulo: string
  detalhe?: string
  marcado: boolean
  aoMudar: (marcado: boolean) => void
  desabilitado?: boolean
}) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className={juntar(
        'flex min-h-11 items-start gap-3 rounded px-1 py-1.5',
        desabilitado ? 'opacity-60' : 'cursor-pointer',
      )}
    >
      <input
        type="checkbox"
        id={id}
        checked={marcado}
        disabled={desabilitado}
        onChange={(evento) => aoMudar(evento.target.checked)}
        className="accent-accent mt-0.5 h-4 w-4"
      />
      <span className="min-w-0">
        <span className="text-ink block text-sm">{rotulo}</span>
        {detalhe ? <span className="text-ink-muted block text-xs">{detalhe}</span> : null}
      </span>
    </label>
  )
}
