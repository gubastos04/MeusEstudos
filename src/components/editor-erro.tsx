'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { atualizar, enviar, remover } from '@/lib/cliente-api'
import { Botao, Cartao, Nota } from './ui'

/**
 * Registro de erro.
 *
 * O formulario segue a estrutura que faz o registro valer depois: erro, causa,
 * solucao e aprendizado. Sem os dois ultimos, o registro vira so um desabafo.
 *
 * O mesmo componente cria e edita, para o formulario ser exatamente o mesmo nos
 * dois casos.
 */

export type ErroRegistrado = {
  id: string
  titulo: string
  contexto: string
  causa: string
  solucao: string
  aprendizado: string
  codigo: string
  linguagem: string
  tecnologia: string
  resolvido: boolean
}

const vazio: Omit<ErroRegistrado, 'id'> = {
  titulo: '',
  contexto: '',
  causa: '',
  solucao: '',
  aprendizado: '',
  codigo: '',
  linguagem: 'text',
  tecnologia: '',
  resolvido: false,
}

export function EditorErro({
  registro,
  aoCancelar,
}: {
  registro?: ErroRegistrado
  aoCancelar?: () => void
}) {
  const router = useRouter()
  const editando = Boolean(registro)
  const [dados, setDados] = useState<Omit<ErroRegistrado, 'id'>>(registro ?? vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  async function salvar() {
    if (salvando || dados.titulo.trim().length < 3) return
    setSalvando(true)
    setErro(null)

    const corpo = {
      titulo: dados.titulo,
      contexto: dados.contexto,
      causa: dados.causa,
      solucao: dados.solucao,
      aprendizado: dados.aprendizado,
      codigo: dados.codigo,
      linguagem: dados.linguagem,
      tecnologia: dados.tecnologia,
      resolvido: dados.resolvido,
    }

    const resposta = registro
      ? await atualizar(`/api/erros/${registro.id}`, corpo)
      : await enviar<{ id: string }>('/api/erros', corpo)

    setSalvando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    if (registro) {
      router.refresh()
      aoCancelar?.()
      return
    }

    setDados(vazio)
    router.refresh()
    aoCancelar?.()
  }

  async function excluir() {
    if (!registro || salvando) return
    setSalvando(true)

    const resposta = await remover(`/api/erros/${registro.id}`)
    setSalvando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    router.push('/erros')
    router.refresh()
  }

  const classe =
    'border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base leading-relaxed'

  return (
    <Cartao className="space-y-4">
      <Nota>Seja honesto aqui. O registro só serve se for verdade.</Nota>

      <Campo
        id="erro-titulo"
        rotulo="O erro"
        ajuda="A mensagem, ou o comportamento observado."
        valor={dados.titulo}
        aoMudar={(valor) => setDados((atual) => ({ ...atual, titulo: valor }))}
        linhas={1}
        classe={classe}
        placeholder="CORS bloqueando requisição"
      />

      <Campo
        id="erro-contexto"
        rotulo="Contexto"
        ajuda="O que você estava fazendo quando aconteceu."
        valor={dados.contexto}
        aoMudar={(valor) => setDados((atual) => ({ ...atual, contexto: valor }))}
        linhas={2}
        classe={classe}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          id="erro-causa"
          rotulo="Causa"
          ajuda="O que estava acontecendo de verdade."
          valor={dados.causa}
          aoMudar={(valor) => setDados((atual) => ({ ...atual, causa: valor }))}
          linhas={3}
          classe={classe}
          placeholder="A API não permitia a origem do frontend."
        />

        <Campo
          id="erro-solucao"
          rotulo="Solução"
          ajuda="O que resolveu."
          valor={dados.solucao}
          aoMudar={(valor) => setDados((atual) => ({ ...atual, solucao: valor }))}
          linhas={3}
          classe={classe}
          placeholder="Configurar CORS no backend."
        />
      </div>

      <Campo
        id="erro-aprendizado"
        rotulo="Aprendizado"
        ajuda="O que você leva disso para a próxima vez. É a parte que vale na revisão."
        valor={dados.aprendizado}
        aoMudar={(valor) => setDados((atual) => ({ ...atual, aprendizado: valor }))}
        linhas={2}
        classe={classe}
        placeholder="O navegador aplica política de mesma origem."
      />

      <Campo
        id="erro-codigo"
        rotulo="Código relacionado"
        valor={dados.codigo}
        aoMudar={(valor) => setDados((atual) => ({ ...atual, codigo: valor }))}
        linhas={5}
        classe={`${classe} font-mono text-[13px]`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="erro-tecnologia" className="text-ink block text-sm font-medium">
            Tecnologia
          </label>
          <input
            id="erro-tecnologia"
            value={dados.tecnologia}
            onChange={(evento) => setDados((atual) => ({ ...atual, tecnologia: evento.target.value }))}
            className={classe}
            placeholder="FastAPI, PostgreSQL, React…"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="erro-linguagem" className="text-ink block text-sm font-medium">
            Linguagem
          </label>
          <select
            id="erro-linguagem"
            value={dados.linguagem}
            onChange={(evento) => setDados((atual) => ({ ...atual, linguagem: evento.target.value }))}
            className={classe}
          >
            {['text', 'python', 'javascript', 'typescript', 'sql', 'html', 'css', 'bash', 'java', 'php'].map(
              (linguagem) => (
                <option key={linguagem} value={linguagem}>
                  {linguagem}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <label className="text-ink flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dados.resolvido}
          onChange={(evento) => setDados((atual) => ({ ...atual, resolvido: evento.target.checked }))}
          className="accent-accent h-4 w-4"
        />
        Já está resolvido
      </label>

      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          type="button"
          variante="primario"
          onClick={salvar}
          disabled={salvando || dados.titulo.trim().length < 3}
        >
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar erro'}
        </Botao>

        {aoCancelar ? (
          <Botao type="button" variante="discreto" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Botao>
        ) : null}

        {registro ? (
          confirmandoExclusao ? (
            <>
              <Botao type="button" variante="perigo" onClick={excluir} disabled={salvando}>
                Confirmar exclusão
              </Botao>
              <Botao type="button" variante="discreto" onClick={() => setConfirmandoExclusao(false)}>
                Manter
              </Botao>
            </>
          ) : (
            <Botao type="button" variante="perigo" onClick={() => setConfirmandoExclusao(true)}>
              Excluir
            </Botao>
          )
        ) : null}
      </div>
    </Cartao>
  )
}

function Campo({
  id,
  rotulo,
  ajuda,
  valor,
  aoMudar,
  linhas,
  classe,
  placeholder,
}: {
  id: string
  rotulo: string
  ajuda?: string
  valor: string
  aoMudar: (valor: string) => void
  linhas: number
  classe: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {rotulo}
      </label>
      {ajuda ? (
        <p id={`${id}-ajuda`} className="text-ink-muted text-xs">
          {ajuda}
        </p>
      ) : null}
      {linhas === 1 ? (
        <input
          id={id}
          value={valor}
          onChange={(evento) => aoMudar(evento.target.value)}
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          className={classe}
          placeholder={placeholder}
        />
      ) : (
        <textarea
          id={id}
          value={valor}
          onChange={(evento) => aoMudar(evento.target.value)}
          rows={linhas}
          aria-describedby={ajuda ? `${id}-ajuda` : undefined}
          className={classe}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}
