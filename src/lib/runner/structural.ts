import type { StructuralCheck } from '../content/schema'
import type { CaseResult } from './types'

/**
 * Verificacao estrutural: le o codigo e procura padroes.
 *
 * Existe para linguagens sem runtime disponivel na plataforma (SQL, HTML,
 * configuracao, Dockerfile). Nao prova que o codigo funciona, e a interface
 * precisa deixar isso explicito para nao dar falsa confianca.
 *
 * Funcao pura: roda igual no navegador e no servidor (avaliacoes).
 */

export function runStructuralChecks(code: string, checks: StructuralCheck[]): CaseResult[] {
  return checks.map((check) => {
    const haystack = check.caseSensitive ? code : code.toLowerCase()
    const needle = check.caseSensitive ? check.value : check.value.toLowerCase()

    let passed = false
    let message: string | undefined

    switch (check.type) {
      case 'contains':
        passed = haystack.includes(needle)
        break
      case 'notContains':
        passed = !haystack.includes(needle)
        break
      case 'regex': {
        try {
          passed = new RegExp(check.value, check.caseSensitive ? '' : 'i').test(code)
        } catch {
          passed = false
          message = 'A verificação deste exercício está mal configurada (regex inválida).'
        }
        break
      }
      case 'minLines': {
        const minimum = Number(check.value)
        const lines = code.split('\n').filter((line) => line.trim().length > 0).length
        passed = Number.isFinite(minimum) && lines >= minimum
        if (!passed) message = `Encontrei ${lines} linha(s) com conteúdo.`
        break
      }
    }

    return {
      name: check.name,
      passed,
      mode: 'estrutura' as const,
      message: passed ? undefined : (message ?? check.hint),
    }
  })
}
