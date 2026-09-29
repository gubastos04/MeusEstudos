'use client'

import { useState } from 'react'

import { Botao } from './ui'
import { EditorErro } from './editor-erro'

/** Botao de novo registro com o formulario aparecendo no lugar, sem trocar de tela. */
export function NovoErro() {
  const [aberto, setAberto] = useState(false)

  if (!aberto) {
    return (
      <Botao type="button" variante="primario" onClick={() => setAberto(true)}>
        Registrar um erro
      </Botao>
    )
  }

  return <EditorErro aoCancelar={() => setAberto(false)} />
}
