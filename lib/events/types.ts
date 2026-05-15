export type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated'
  key?: string
}
