'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { atualizar, enviar } from '@/lib/cliente-api'
import { Botao, Cartao, Nota, Selo, juntar } from './ui'

/**
 * Preferencias, conta e configuracao de IA.
 *
 * A chave de IA e enviada uma unica vez e nunca volta: a interface mostra
 * apenas os quatro ultimos caracteres, como qualquer serviço sério faz.
 */

type Trilha = { id: string; title: string; summary: string }

type Props = {
  nome: string
  email: string
  tema: string
  tamanhoFonteCodigo: number
  minutosTipicos: number
  trilhaId: string | null
  trilhas: Trilha[]
  github: string
  linkedin: string
  ia: {
    configurada: boolean
    habilitada: boolean
    origem: string
    modelo: string
    limiteDiario: number
    usadasHoje: number
    dicaChave: string | null
  }
}

export function PainelPerfil(props: Props) {
  const router = useRouter()

  const [nome, setNome] = useState(props.nome)
  const [tema, setTema] = useState(props.tema)
  const [fonte, setFonte] = useState(props.tamanhoFonteCodigo)
  const [minutos, setMinutos] = useState(String(props.minutosTipicos))
  const [trilha, setTrilha] = useState(props.trilhaId ?? '')
  const [github, setGithub] = useState(props.github)
  const [linkedin, setLinkedin] = useState(props.linkedin)

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')

  const [chaveIa, setChaveIa] = useState('')
  const [modeloIa, setModeloIa] = useState(props.ia.modelo)
  const [limiteIa, setLimiteIa] = useState(props.ia.limiteDiario)
  const [iaHabilitada, setIaHabilitada] = useState(props.ia.habilitada)
  const [dicaChave, setDicaChave] = useState(props.ia.dicaChave)

  const [senhaExclusao, setSenhaExclusao] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [zonaPerigoAberta, setZonaPerigoAberta] = useState(false)

  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const classe =
    'border-line bg-surface text-ink placeholder:text-ink-faint w-full rounded border px-3 py-2.5 text-base'

  async function salvarPreferencias() {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    setMensagem(null)

    const resposta = await atualizar('/api/perfil', {
      nome,
      tema,
      tamanhoFonteCodigo: fonte,
      minutosTipicos: Number(minutos),
      trilhaId: trilha || undefined,
      github,
      linkedin,
    })

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setMensagem('Preferências salvas.')
    router.refresh()
  }

  async function trocarSenha() {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    setMensagem(null)

    const resposta = await atualizar('/api/perfil', { senhaAtual, novaSenha })

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setSenhaAtual('')
    setNovaSenha('')
    setMensagem('Senha alterada. As outras sessões foram encerradas.')
  }

  async function salvarIa(remover = false) {
    if (ocupado) return
    setOcupado(true)
    setErro(null)
    setMensagem(null)

    const resposta = await atualizar<{ dicaChave: string | null; configurada: boolean }>(
      '/api/perfil/ia',
      {
        chave: remover ? undefined : chaveIa || undefined,
        removerChave: remover,
        modelo: modeloIa,
        limiteDiario: limiteIa,
        habilitada: iaHabilitada,
      },
    )

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    setChaveIa('')
    setDicaChave(resposta.dados.dicaChave)
    setMensagem(remover ? 'Chave removida.' : 'Configuração de IA salva.')
    router.refresh()
  }

  async function sair() {
    await enviar('/api/auth/sair', {})
    router.replace('/entrar')
    router.refresh()
  }

  async function excluirConta() {
    if (ocupado) return
    setOcupado(true)
    setErro(null)

    const resposta = await enviar<{ proximo: string }>('/api/perfil/conta', {
      senha: senhaExclusao,
      confirmacao,
    })

    setOcupado(false)

    if (!resposta.ok) {
      setErro(resposta.erro)
      return
    }

    router.replace('/entrar')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {mensagem ? <p className="text-ok-ink text-sm">{mensagem}</p> : null}
      {erro ? (
        <p role="alert" className="text-danger-ink text-sm">
          {erro}
        </p>
      ) : null}

      <Cartao className="space-y-4">
        <h2 className="text-ink text-base font-semibold">Conta</h2>

        <div className="space-y-1.5">
          <label htmlFor="perfil-nome" className="text-ink block text-sm font-medium">
            Nome
          </label>
          <input
            id="perfil-nome"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            className={classe}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="perfil-email" className="text-ink block text-sm font-medium">
            Email
          </label>
          <input id="perfil-email" value={props.email} readOnly disabled className={classe} />
          <p className="text-ink-faint text-xs">O email não pode ser alterado nesta versão.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="perfil-github" className="text-ink block text-sm font-medium">
              Usuário do GitHub
            </label>
            <input
              id="perfil-github"
              value={github}
              onChange={(evento) => setGithub(evento.target.value)}
              className={classe}
              placeholder="seu-usuario"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="perfil-linkedin" className="text-ink block text-sm font-medium">
              LinkedIn
            </label>
            <input
              id="perfil-linkedin"
              type="url"
              value={linkedin}
              onChange={(evento) => setLinkedin(evento.target.value)}
              className={classe}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
        </div>
      </Cartao>

      <Cartao className="space-y-4">
        <h2 className="text-ink text-base font-semibold">Preferências</h2>

        <div className="space-y-1.5">
          <label htmlFor="perfil-tema" className="text-ink block text-sm font-medium">
            Tema
          </label>
          <select
            id="perfil-tema"
            value={tema}
            onChange={(evento) => setTema(evento.target.value)}
            className={classe}
          >
            <option value="system">Seguir o sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="perfil-minutos" className="text-ink block text-sm font-medium">
            Tempo que você costuma ter
          </label>
          <p className="text-ink-muted text-xs">
            Usado para dimensionar a sugestão. Não é meta nem compromisso.
          </p>
          <select
            id="perfil-minutos"
            value={minutos}
            onChange={(evento) => setMinutos(evento.target.value)}
            className={classe}
          >
            <option value="10">10 minutos</option>
            <option value="20">20 minutos</option>
            <option value="45">Mais de 40 minutos</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="perfil-fonte" className="text-ink block text-sm font-medium">
            Tamanho da fonte do editor de código: {fonte}px
          </label>
          <input
            id="perfil-fonte"
            type="range"
            min={11}
            max={20}
            value={fonte}
            onChange={(evento) => setFonte(Number(evento.target.value))}
            className="accent-accent w-full"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="perfil-trilha" className="text-ink block text-sm font-medium">
            Caminho de estudo
          </label>
          <select
            id="perfil-trilha"
            value={trilha}
            onChange={(evento) => setTrilha(evento.target.value)}
            className={classe}
          >
            <option value="">Sem caminho definido</option>
            {props.trilhas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <p className="text-ink-faint text-xs">
            O caminho só muda a ordem sugerida. Todo o conteúdo continua acessível.
          </p>
        </div>

        <Botao type="button" variante="primario" onClick={salvarPreferencias} disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </Botao>
      </Cartao>

      <Cartao className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink text-base font-semibold">Inteligência artificial</h2>
          <Selo tom={props.ia.configurada ? 'accent' : 'neutro'}>
            {props.ia.configurada ? `ativa (${props.ia.origem})` : 'não configurada'}
          </Selo>
        </div>

        <Nota>
          A IA é opcional. Sem chave, a plataforma funciona igual: os botões continuam visíveis e avisam que
          a IA não está configurada. A chave fica criptografada no servidor e nunca é devolvida.
        </Nota>

        <div className="space-y-1.5">
          <label htmlFor="ia-chave" className="text-ink block text-sm font-medium">
            Sua chave da Anthropic
          </label>
          {dicaChave ? (
            <p className="text-ink-muted text-xs">
              Uma chave já está salva, terminada em <span className="font-mono">{dicaChave}</span>. Enviar
              outra substitui a atual.
            </p>
          ) : (
            <p className="text-ink-muted text-xs">
              Começa com sk-ant-. Sem ela, a plataforma usa a chave do servidor, se houver.
            </p>
          )}
          <input
            id="ia-chave"
            type="password"
            value={chaveIa}
            onChange={(evento) => setChaveIa(evento.target.value)}
            className={`${classe} font-mono text-sm`}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="ia-modelo" className="text-ink block text-sm font-medium">
              Modelo
            </label>
            <input
              id="ia-modelo"
              value={modeloIa}
              onChange={(evento) => setModeloIa(evento.target.value)}
              className={`${classe} font-mono text-sm`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ia-limite" className="text-ink block text-sm font-medium">
              Limite diário de chamadas
            </label>
            <input
              id="ia-limite"
              type="number"
              min={0}
              max={500}
              value={limiteIa}
              onChange={(evento) => setLimiteIa(Number(evento.target.value))}
              className={classe}
            />
            <p className="text-ink-faint text-xs tabular-nums">
              {props.ia.usadasHoje} chamadas hoje.
            </p>
          </div>
        </div>

        <label className="text-ink flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={iaHabilitada}
            onChange={(evento) => setIaHabilitada(evento.target.checked)}
            className="accent-accent h-4 w-4"
          />
          Manter a IA ligada
        </label>

        <div className="flex flex-wrap gap-2">
          <Botao type="button" variante="primario" onClick={() => salvarIa(false)} disabled={ocupado}>
            Salvar configuração
          </Botao>
          {dicaChave ? (
            <Botao type="button" variante="secundario" onClick={() => salvarIa(true)} disabled={ocupado}>
              Remover chave
            </Botao>
          ) : null}
        </div>
      </Cartao>

      <Cartao className="space-y-4">
        <h2 className="text-ink text-base font-semibold">Segurança</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="senha-atual" className="text-ink block text-sm font-medium">
              Senha atual
            </label>
            <input
              id="senha-atual"
              type="password"
              value={senhaAtual}
              onChange={(evento) => setSenhaAtual(evento.target.value)}
              className={classe}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nova-senha" className="text-ink block text-sm font-medium">
              Nova senha
            </label>
            <input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(evento) => setNovaSenha(evento.target.value)}
              className={classe}
              autoComplete="new-password"
            />
            <p className="text-ink-faint text-xs">Pelo menos 10 caracteres.</p>
          </div>
        </div>

        <Botao
          type="button"
          variante="secundario"
          onClick={trocarSenha}
          disabled={ocupado || senhaAtual.length === 0 || novaSenha.length < 10}
        >
          Trocar senha
        </Botao>

        <div className="border-line border-t pt-4">
          <Botao type="button" variante="secundario" onClick={sair}>
            Sair desta conta
          </Botao>
        </div>
      </Cartao>

      <Cartao className="border-danger/30 space-y-3">
        <h2 className="text-ink text-base font-semibold">Excluir conta</h2>
        <p className="text-ink-muted text-sm">
          Apaga tudo: progresso, anotações, erros, demandas, projetos e configuração de IA. Não tem volta.
        </p>

        {!zonaPerigoAberta ? (
          <Botao type="button" variante="perigo" onClick={() => setZonaPerigoAberta(true)}>
            Quero excluir minha conta
          </Botao>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="senha-exclusao" className="text-ink block text-sm font-medium">
                Sua senha
              </label>
              <input
                id="senha-exclusao"
                type="password"
                value={senhaExclusao}
                onChange={(evento) => setSenhaExclusao(evento.target.value)}
                className={classe}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmacao" className="text-ink block text-sm font-medium">
                Digite EXCLUIR para confirmar
              </label>
              <input
                id="confirmacao"
                value={confirmacao}
                onChange={(evento) => setConfirmacao(evento.target.value)}
                className={juntar(classe, 'font-mono')}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Botao
                type="button"
                variante="perigo"
                onClick={excluirConta}
                disabled={ocupado || confirmacao !== 'EXCLUIR' || senhaExclusao.length === 0}
              >
                Excluir definitivamente
              </Botao>
              <Botao type="button" variante="discreto" onClick={() => setZonaPerigoAberta(false)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </Cartao>
    </div>
  )
}
