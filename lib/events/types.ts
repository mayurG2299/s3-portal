export type FileChangedPayload = {
  bucketId: string
  action: 'uploaded' | 'deleted' | 'moved' | 'folder-created' | 'metadata-updated' | 'indexing-status-changed'
  key?: string
  indexingStatus?: 'DONE' | 'FAILED'
}
