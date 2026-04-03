import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test ENCRYPTION_SECRET: 64-char hex representing 32 bytes (all zeros except last byte = 1)
const TEST_SECRET = '0000000000000000000000000000000000000000000000000000000000000001'

describe('ACTN-04: Credential encryption at rest', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_SECRET', TEST_SECRET)
  })

  it('encrypt() produces iv:ciphertext format (base64:base64) — not plaintext', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const result = await encrypt('myApiKey')
    // Must match ivBase64:ciphertextBase64 — two base64 segments separated by colon
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/)
    // Must not contain the plaintext
    expect(result).not.toContain('myApiKey')
  })

  it('decrypt(encrypt(plaintext)) returns original plaintext — round-trip', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const plaintext = 'myApiKey'
    const encrypted = await encrypt(plaintext)
    const decrypted = await decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('two encrypt() calls on the same plaintext produce different ciphertext (IV randomness)', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const first = await encrypt('same')
    const second = await encrypt('same')
    expect(first).not.toBe(second)
  })

  it('decrypt() with wrong key throws — does not return garbage plaintext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    // Encrypt with TEST_SECRET
    const encrypted = await encrypt('secret-data')
    // Switch to a different key
    vi.stubEnv('ENCRYPTION_SECRET', '0000000000000000000000000000000000000000000000000000000000000002')
    await expect(decrypt(encrypted)).rejects.toThrow()
  })

  it('maskApiKey() returns last-4 characters preceded by asterisks — never full key', async () => {
    const { maskApiKey } = await import('@/lib/crypto')
    const result = maskApiKey('sk-abc1234567890xyz')
    expect(result).toBe('••••••••0xyz')
    expect(result).not.toContain('sk-abc')
    expect(result).not.toContain('sk-abc1234567890xyz')
  })
})
