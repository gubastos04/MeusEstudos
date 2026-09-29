'use client'

import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'

/**
 * Implementacao do editor.
 *
 * Tudo que depende do CodeMirror mora neste arquivo, carregado sob demanda por
 * editor-codigo.tsx. O motivo e concreto: as extensoes de linguagem precisam
 * compartilhar a MESMA instancia de @codemirror/state que o editor. Carregar
 * as linguagens por require() em outro ponto do bundle duplica esse modulo e o
 * editor falha com "Unrecognized extension value in extension set".
 */

export type PropsEditorInterno = {
  valor: string
  aoMudar: (valor: string) => void
  linguagem: string
  somenteLeitura: boolean
  altura: number
}

export default function EditorCodigoInterno({
  valor,
  aoMudar,
  linguagem,
  somenteLeitura,
  altura,
}: PropsEditorInterno) {
  const extensoes = useMemo(() => {
    switch (linguagem) {
      case 'python':
        return [python()]
      case 'javascript':
        return [javascript()]
      case 'typescript':
        return [javascript({ typescript: true })]
      case 'sql':
        return [sql()]
      default:
        // Linguagem sem suporte de realce continua editavel como texto.
        return []
    }
  }, [linguagem])

  return (
    <CodeMirror
      value={valor}
      height={`${altura}px`}
      editable={!somenteLeitura}
      readOnly={somenteLeitura}
      extensions={extensoes}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !somenteLeitura,
        autocompletion: false,
        // Atalhos de busca dentro do editor atrapalham no celular.
        searchKeymap: false,
      }}
      onChange={aoMudar}
    />
  )
}
