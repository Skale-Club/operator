import { describe, it } from 'vitest'

describe('ACTN-04: Credential encryption at rest', () => {
  it.todo('encrypt() produces iv:ciphertext format (base64:base64) — not plaintext')
  it.todo('decrypt(encrypt(plaintext)) returns original plaintext — round-trip')
  it.todo('two encrypt() calls on the same plaintext produce different ciphertext (IV randomness)')
  it.todo('decrypt() with wrong key throws — does not return garbage plaintext')
  it.todo('maskApiKey() returns last-4 characters preceded by asterisks — never full key')
})
