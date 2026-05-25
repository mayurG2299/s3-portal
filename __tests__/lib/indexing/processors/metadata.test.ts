import { processMetadata } from '@/lib/indexing/processors/metadata'

describe('processMetadata', () => {
  it('formats name, tags and description', () => {
    const file = { name: 'report.pdf', tags: ['q4', 'finance'], description: 'Annual report' }
    const result = processMetadata(file as any)
    expect(result).toContain('report.pdf')
    expect(result).toContain('q4')
    expect(result).toContain('finance')
    expect(result).toContain('Annual report')
  })

  it('handles missing tags and description gracefully', () => {
    const file = { name: 'photo.jpg', tags: [], description: null }
    const result = processMetadata(file as any)
    expect(result).toBe('photo.jpg')
  })
})
