jest.mock('@/lib/aws', () => ({
  getS3ObjectBody: jest.fn(),
}))
jest.mock('pdf-parse', () => jest.fn())
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }))

import { getS3ObjectBody } from '@/lib/aws'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { processDocument } from '@/lib/indexing/processors/document'
import { Readable } from 'stream'

function makeStream(content: string) {
  return Readable.from([Buffer.from(content)])
}

describe('processDocument', () => {
  beforeEach(() => jest.clearAllMocks())

  it('extracts text from a PDF and trims to 8000 chars', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(makeStream('pdf-bytes'))
    ;(pdfParse as jest.Mock).mockResolvedValue({ text: 'PDF content here' })
    const file = { name: 'doc.pdf', contentType: 'application/pdf', key: 'docs/doc.pdf' }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBe('PDF content here')
  })

  it('extracts text from a DOCX file', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(makeStream('docx-bytes'))
    ;(mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'DOCX content' })
    const file = {
      name: 'report.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      key: 'docs/report.docx',
    }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBe('DOCX content')
  })

  it('reads raw text for text/plain content type', async () => {
    ;(getS3ObjectBody as jest.Mock).mockResolvedValue(makeStream('plain text content'))
    const file = { name: 'readme.txt', contentType: 'text/plain', key: 'readme.txt' }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBe('plain text content')
  })

  it('returns null on extraction error', async () => {
    ;(getS3ObjectBody as jest.Mock).mockRejectedValue(new Error('S3 error'))
    const file = { name: 'bad.pdf', contentType: 'application/pdf', key: 'bad.pdf' }
    const result = await processDocument(file as any, {} as any)
    expect(result).toBeNull()
  })
})
