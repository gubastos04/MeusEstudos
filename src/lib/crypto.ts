import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

import { env } from './env'

// promisify perde a sobrecarga que aceita opcoes; o tipo e reposto aqui.
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

/**
 * Criptografia do projeto. Usa apenas node:crypto — sem dependencia nativa,
 * o que mantem o deploy simples (inclusive em serverless).
 *
 * - senha: scrypt com salt aleatorio por usuario;
 * - token de sessao: 32 bytes aleatorios, guardados no banco apenas como SHA-256;
 * - chave de IA do usuario: AES-256-GCM com chave derivada de APP_SECRET.
 */

// Custo do scrypt. 2^16 leva ~100ms em hardware modesto, o que e adequado para
// login interativo e caro o bastante para forca bruta offline.
const SCRYPT_COST = 2 ** 16
const SCRYPT_BLOCK = 8
const SCRYPT_PARALLEL = 1
const SCRYPT_KEYLEN = 64
// 128 * N * r = ~67MB; o padrao do Node (32MB) recusaria estes parametros.
const SCRYPT_MAXMEM = 96 * 1024 * 1024

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK,
    p: SCRYPT_PARALLEL,
    maxmem: SCRYPT_MAXMEM,
  }))

  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK,
    SCRYPT_PARALLEL,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const cost = Number(parts[1])
  const block = Number(parts[2])
  const parallel = Number(parts[3])
  const salt = Buffer.from(parts[4] ?? '', 'base64url')
  const expected = Buffer.from(parts[5] ?? '', 'base64url')

  if (!Number.isFinite(cost) || !Number.isFinite(block) || !Number.isFinite(parallel)) return false
  if (salt.length === 0 || expected.length === 0) return false

  try {
    const derived = (await scrypt(password.normalize('NFKC'), salt, expected.length, {
      N: cost,
      r: block,
      p: parallel,
      maxmem: SCRYPT_MAXMEM,
    }))
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/** Token opaco para cookie de sessao. Nunca e gravado em claro. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** HMAC usado em tokens de CSRF e em outros valores assinados. */
export function sign(value: string): string {
  return createHmac('sha256', env().APP_SECRET).update(value).digest('base64url')
}

export function verifySignature(value: string, signature: string): boolean {
  const expected = Buffer.from(sign(value))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

// --- Chave de IA por usuario -------------------------------------------------

function encryptionKey(): Buffer {
  // Chave de 32 bytes derivada do APP_SECRET com um rotulo, para que este uso
  // nao compartilhe material com a assinatura de cookies.
  return createHash('sha256').update(`ai-key-v1:${env().APP_SECRET}`).digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

/** Devolve null quando o valor foi cifrado com outro APP_SECRET ou esta corrompido. */
export function decryptSecret(payload: string): string | null {
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null

  try {
    const iv = Buffer.from(parts[1] ?? '', 'base64url')
    const tag = Buffer.from(parts[2] ?? '', 'base64url')
    const data = Buffer.from(parts[3] ?? '', 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** Ultimos 4 caracteres, para o usuario reconhecer a chave sem expo-la. */
export function keyHint(apiKey: string): string {
  return apiKey.slice(-4)
}
