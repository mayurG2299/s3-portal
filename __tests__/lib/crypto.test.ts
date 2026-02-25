import { encrypt, decrypt, hashPassword, verifyPassword } from '@/lib/crypto'

describe('Crypto Module', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', async () => {
      const plaintext = 'test-secret-data'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(encrypted).not.toBe(plaintext)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertexts for same plaintext', async () => {
      const plaintext = 'test-secret-data'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)
      
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should handle AWS credentials format', async () => {
      const credentials = JSON.stringify({
        accessKeyId: 'AKIA...',
        secretAccessKey: 'wJal...',
        sessionToken: 'optional-token'
      })
      
      const encrypted = encrypt(credentials)
      const decrypted = decrypt(encrypted)
      
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(credentials))
    })

    it('should throw error on invalid ciphertext', async () => {
      expect(() => {
        decrypt('invalid-base64-ciphertext!')
      }).toThrow()
    })

    it('should throw error on corrupted encryption key', async () => {
      const original = process.env.ENCRYPTION_KEY
      try {
        process.env.ENCRYPTION_KEY = ''
        expect(() => {
          encrypt('test')
        }).toThrow('Failed to encrypt data')
      } finally {
        process.env.ENCRYPTION_KEY = original
      }
    })
  })

  describe('hashPassword/verifyPassword', () => {
    it('should hash password consistently', async () => {
      const password = 'SecurePassword123!'
      const hash = await hashPassword(password)
      
      expect(hash).toContain(':')
      expect(hash.length).toBeGreaterThan(50)
    })

    it('should verify correct password', async () => {
      const password = 'SecurePassword123!'
      const hash = await hashPassword(password)
      const isValid = await verifyPassword(password, hash)
      
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'SecurePassword123!'
      const hash = await hashPassword(password)
      const isValid = await verifyPassword('WrongPassword', hash)
      
      expect(isValid).toBe(false)
    })

    it('should produce different hashes for same password', async () => {
      const password = 'SecurePassword123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      
      expect(hash1).not.toBe(hash2)
    })

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(256)
      const hash = await hashPassword(password)
      const isValid = await verifyPassword(password, hash)
      
      expect(isValid).toBe(true)
    })

    it('should handle special characters in passwords', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const hash = await hashPassword(password)
      const isValid = await verifyPassword(password, hash)
      
      expect(isValid).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty strings', async () => {
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe('')
    })

    it('should handle unicode characters', async () => {
      const plaintext = 'こんにちは 🚀 مرحبا'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should handle very large data', async () => {
      const plaintext = 'x'.repeat(1000000) // 1MB
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })
  })
})
