interface FileRecord {
  name: string
  tags: string[]
  description: string | null
}

export function processMetadata(file: FileRecord): string {
  const parts = [file.name]
  if (file.tags.length > 0) parts.push(file.tags.join(', '))
  if (file.description) parts.push(file.description)
  return parts.join('. ')
}
