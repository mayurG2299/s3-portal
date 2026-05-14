/** @jest-environment node */

// Test the parentPath derivation logic.
// Current (broken) behaviour: uses browsePath, not the S3 key.
// Correct behaviour: derives from the object's S3 key.

function brokenDeriveParentPath(_s3Key: string, browsePath: string): string {
  return browsePath
}

function correctDeriveParentPath(s3Key: string): string {
  const isFolder = s3Key.endsWith('/')
  const keyToUse = isFolder ? s3Key.slice(0, -1) : s3Key
  const parts = keyToUse.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return '/' + parts.slice(0, -1).join('/') + '/'
}

describe('S3 auto-sync parentPath derivation', () => {
  describe('broken implementation', () => {
    it('incorrectly assigns browse path as parentPath for nested files', () => {
      expect(brokenDeriveParentPath('a/b/c.txt', '/a/')).toBe('/a/')
      expect(brokenDeriveParentPath('a/b/c.txt', '/a/')).not.toBe('/a/b/')
    })
  })

  describe('correct implementation', () => {
    it('derives root for top-level file', () => {
      expect(correctDeriveParentPath('logo.png')).toBe('/')
    })

    it('derives correct parent for one-level-deep file', () => {
      expect(correctDeriveParentPath('docs/brief.pdf')).toBe('/docs/')
    })

    it('derives correct parent for nested file', () => {
      expect(correctDeriveParentPath('marketing/images/logo.png')).toBe('/marketing/images/')
    })

    it('derives root for top-level folder', () => {
      expect(correctDeriveParentPath('marketing/')).toBe('/')
    })

    it('derives correct parent for nested folder', () => {
      expect(correctDeriveParentPath('marketing/images/')).toBe('/marketing/')
    })
  })
})
