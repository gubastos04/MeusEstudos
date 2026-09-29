'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { Campo } from './campos'
import { Botao, ErroTecnico } from './ui'

/**
 * Entrada e cadastro.
 *
 * Sem validacao agressiva a cada tecla: o erro aparece depois do envio, e
 * nenhum campo preenchido e apagado quando o servidor recusa.
 */

type Modo = 'entrar' | 'criar'

export function FormularioAuth({ modo }: { modo: Modo }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [campoComErro, setCampoComErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault()
    if (enviando) return

    setEnviando(true)
    setErro(null)
    setCampoComErro(null)

    const url = modo === 'entrar' ? '/api/auth/entrar' : '/api/auth/registrar'
    const corpo = modo === 'entrar' ? { email, senha } : { nome, email, senha }

    const resposta = await enviar<{ proximo: string }>(url, corpo)

    if (!resposta.ok) {
      setErro(resposta.erro)
      setCampoComErro(resposta.campo ?? null)
      setEnviando(false)
      return
    }

    // O destino vem do servidor: quem nunca respondeu o início vai para /comecar.
    router.replace(resposta.dados.proximo ?? '/inicio')
    router.refresh()
  }

  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      {erro ? <ErroTecnico titulo="Não foi possível continuar" descricao={erro} /> : null}

      {modo === 'criar' ? (
        <Campo
          rotulo="Nome"
          name="nome"
          autoComplete="name"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          erro={campoComErro === 'nome' ? erro : null}
          obrigatorio
        />
      ) : null}

      <Campo
        rotulo="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
        erro={campoComErro === 'email' ? erro : null}
        obrigatorio
      />

      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
        ajuda={modo === 'criar' ? 'Pelo menos 10 caracteres.' : undefined}
        value={senha}
        onChange={(evento) => setSenha(evento.target.value)}
        erro={campoComErro === 'senha' ? erro : null}
        obrigatorio
      />

      <Botao type="submit" variante="primario" larguraTotal disabled={enviando}>
        {enviando ? 'Enviando…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
      </Botao>
    </form>
  )
}
