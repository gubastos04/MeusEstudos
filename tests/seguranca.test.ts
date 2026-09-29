import { describe, expect, it } from 'vitest'

import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  hashToken,
  keyHint,
  newSessionToken,
  sign,
  verifyPassword,
  verifySignature,
} from '@/lib/crypto'

/**
 * Criptografia.
 *
 * O que estes testes protegem: senha nunca em claro, chave de IA ilegivel sem o
 * APP_SECRET certo, e token de sessao guardado apenas como hash.
 */

describe('senha', () => {
  it('nunca guarda a senha em claro', async () => {
    const hash = await hashPassword('minha-senha-secreta')

    expect(hash).not.toContain('minha-senha-secreta')
    expect(hash.startsWith('scrypt$')).toBe(true)
  })

  it('aceita a senha correta', async () => {
    const hash = await hashPassword('senha-correta-123')
    await expect(verifyPassword('senha-correta-123', hash)).resolves.toBe(true)
  })

  it('recusa a senha errada', async () => {
    const hash = await hashPassword('senha-correta-123')
    await expect(verifyPassword('senha-errada-123', hash)).resolves.toBe(false)
  })

  it('gera hashes diferentes para a mesma senha', async () => {
    // Salt por usuário: duas pessoas com a mesma senha não compartilham hash,
    // o que inviabiliza tabela pré-calculada.
    const primeiro = await hashPassword('mesma-senha-aqui')
    const segundo = await hashPassword('mesma-senha-aqui')

    expect(primeiro).not.toEqual(segundo)
  })

  it('não quebra com hash corrompido', async () => {
    await expect(verifyPassword('qualquer', 'lixo')).resolves.toBe(false)
    await expect(verifyPassword('qualquer', 'scrypt$1$2$3')).resolves.toBe(false)
    await expect(verifyPassword('qualquer', '')).resolves.toBe(false)
  })

  it('trata acentuação de forma consistente', async () => {
    const hash = await hashPassword('senha-com-acentuação')
    await expect(verifyPassword('senha-com-acentuação', hash)).resolves.toBe(true)
  })
})

describe('token de sessão', () => {
  it('gera tokens distintos', () => {
    expect(newSessionToken()).not.toEqual(newSessionToken())
  })

  it('o hash não permite recuperar o token', () => {
    const token = newSessionToken()
    const hash = hashToken(token)

    expect(hash).not.toContain(token)
    expect(hash).toHaveLength(64)
    expect(hashToken(token)).toEqual(hash)
  })
})

describe('chave de IA', () => {
  it('cifra e decifra de volta', () => {
    const chave = 'sk-ant-exemplo-de-chave-para-teste'
    const cifrada = encryptSecret(chave)

    expect(cifrada).not.toContain(chave)
    expect(decryptSecret(cifrada)).toEqual(chave)
  })

  it('cifra o mesmo valor de formas diferentes', () => {
    // IV aleatório por operação: dois registros iguais não se denunciam.
    expect(encryptSecret('mesma-chave')).not.toEqual(encryptSecret('mesma-chave'))
  })

  it('devolve null quando o dado foi adulterado', () => {
    const cifrada = encryptSecret('sk-ant-valor')
    const partes = cifrada.split('.')
    const adulterada = [partes[0], partes[1], partes[2], 'AAAA'].join('.')

    expect(decryptSecret(adulterada)).toBeNull()
  })

  it('devolve null para formato inválido', () => {
    expect(decryptSecret('qualquer-coisa')).toBeNull()
    expect(decryptSecret('')).toBeNull()
  })

  it('mostra apenas os quatro últimos caracteres', () => {
    expect(keyHint('sk-ant-abcdefgh1234')).toEqual('1234')
  })
})

describe('assinatura', () => {
  it('valida a própria assinatura', () => {
    const assinatura = sign('valor-importante')
    expect(verifySignature('valor-importante', assinatura)).toBe(true)
  })

  it('recusa assinatura de outro valor', () => {
    const assinatura = sign('valor-importante')
    expect(verifySignature('outro-valor', assinatura)).toBe(false)
  })

  it('não quebra com assinatura de tamanho diferente', () => {
    expect(verifySignature('valor', 'curta')).toBe(false)
  })
})
