'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { enviar } from '@/lib/cliente-api'
import { Campo } from './campos'
import { Botao, ErroTecnico, Nota } from './ui'

/**
 * Recuperacao e redefinicao de senha.
 *
 * O pedido responde sempre a mesma coisa, mesmo quando o email nao tem conta:
 * a tela nao pode servir para descobrir quem esta cadastrado.
 */

export function FormularioRecuperar() {
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault()
    if (enviando) return

    setEnviando(true)
    setErro(null)

    const resposta = await enviar<{ mensagem: string }>('/api/auth/recuperar', { email })

    setEnviando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setMensagem(resposta.dados.mensagem)
  }

  if (mensagem) {
    return (
      <div className="space-y-4">
        <Nota titulo="Pedido registrado">{mensagem}</Nota>
        <p className="text-ink-muted text-sm">
          Não chegou? Verifique o spam e confirme se digitou o mesmo email do cadastro. Você pode pedir de
          novo em alguns minutos.
        </p>
        <Link href="/entrar" className="text-accent-ink text-sm font-medium underline underline-offset-2">
          Voltar para entrar
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      {erro ? <ErroTecnico titulo="Não foi possível enviar" descricao={erro} /> : null}

      <Campo
        rotulo="Email da conta"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(evento) => setEmail(evento.target.value)}
        obrigatorio
      />

      <Botao type="submit" variante="primario" larguraTotal disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar link de redefinição'}
      </Botao>

      <p className="text-ink-muted text-sm">
        Lembrou a senha?{' '}
        <Link href="/entrar" className="text-accent-ink font-medium underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </form>
  )
}

export function FormularioRedefinir({ token }: { token: string }) {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [repeticao, setRepeticao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [campoComErro, setCampoComErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault()
    if (enviando) return

    if (senha !== repeticao) {
      setErro('As duas senhas precisam ser iguais.')
      setCampoComErro('repeticao')
      return
    }

    setEnviando(true)
    setErro(null)
    setCampoComErro(null)

    const resposta = await enviar<{ mensagem: string }>('/api/auth/redefinir', { token, senha })

    setEnviando(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      setCampoComErro(resposta.campo ?? null)
      return
    }

    setConcluido(true)
  }

  if (concluido) {
    return (
      <div className="space-y-4">
        <Nota titulo="Senha alterada">
          As sessões que estavam abertas foram encerradas. Entre com a senha nova.
        </Nota>
        <Botao
          type="button"
          variante="primario"
          larguraTotal
          onClick={() => {
            router.replace('/entrar')
            router.refresh()
          }}
        >
          Ir para entrar
        </Botao>
      </div>
    )
  }

  return (
    <form onSubmit={submeter} className="space-y-4" noValidate>
      {erro && campoComErro !== 'repeticao' ? (
        <ErroTecnico titulo="Não foi possível alterar" descricao={erro} />
      ) : null}

      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        ajuda="Pelo menos 10 caracteres."
        value={senha}
        onChange={(evento) => setSenha(evento.target.value)}
        erro={campoComErro === 'senha' ? erro : null}
        obrigatorio
      />

      <Campo
        rotulo="Repita a nova senha"
        name="repeticao"
        type="password"
        autoComplete="new-password"
        value={repeticao}
        onChange={(evento) => setRepeticao(evento.target.value)}
        erro={campoComErro === 'repeticao' ? erro : null}
        obrigatorio
      />

      <Botao type="submit" variante="primario" larguraTotal disabled={enviando || senha.length < 10}>
        {enviando ? 'Alterando…' : 'Alterar senha'}
      </Botao>
    </form>
  )
}
