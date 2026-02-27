export type PreviewType = 'IMAGE' | 'PDF' | 'VIDEO' | 'AUDIO' | 'TEXT' | 'CSV' | 'UNSUPPORTED'

export function getPreviewType(contentType?: string | null, fileName?: string | null): PreviewType {
  const ct = (contentType || '').toLowerCase()
  const name = (fileName || '').toLowerCase()

  if (ct.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/.test(name)) return 'IMAGE'
  if (ct === 'application/pdf' || name.endsWith('.pdf')) return 'PDF'
  if (ct.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/.test(name)) return 'VIDEO'
  if (ct.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(name)) return 'AUDIO'
  if (ct === 'text/csv' || name.endsWith('.csv')) return 'CSV'
  if (ct.startsWith('text/') || /\.(txt|md|json|log|xml|yaml|yml|csv)$/.test(name)) return 'TEXT'

  return 'UNSUPPORTED'
}

export const PreviewTypeEnum = {
  IMAGE: 'IMAGE',
  PDF: 'PDF',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  TEXT: 'TEXT',
  CSV: 'CSV',
  UNSUPPORTED: 'UNSUPPORTED',
} as const
