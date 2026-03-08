/**
 * Centralized copy for non-technical user-facing terminology
 * Replaces technical infrastructure jargon with friendly, plain-English alternatives
 */

export const COPY = {
  // File upload and management
  UPLOAD_LIMIT: 'Maximum 10 files per upload',
  UPLOAD_ACTIVITY: 'Upload Activity',
  FILE_ITEM: 'file',
  FILES_ITEM: 'files',
  
  // Storage and quota
  STORAGE_QUOTA: 'Storage Used',
  STORAGE_FULL: 'Storage limit reached. Remove files or contact your admin to increase the limit.',
  STORAGE_NEARLY_FULL: 'You are using most of your available storage.',
  
  // Permissions and access
  PERMISSIONS_LABEL: 'Permissions',
  PERMISSIONS_MAP: 'Permissions Map',
  
  // File states
  EMPTY_FILES: 'No files yet. Upload to get started.',
  EMPTY_LINKS: 'No shared links yet.',
  NO_RESULTS_FILES: 'No files found. Try a different search.',
  NO_RESULTS_LINKS: 'No links found. Try a different search.',
  
  // Error states
  ERROR_LOAD_FILES: 'Unable to load files from storage. Please check your connection and try again.',
  ERROR_LOAD_LINKS: 'Unable to load links. Please check your connection and try again.',
  ERROR_CONNECTION: 'Unable to connect to storage. Please contact your admin.',
  ERROR_BUCKET_ACCESS: 'Cannot access the selected bucket. Check your credentials and bucket permissions.',
  ERROR_UPLOAD_FAILED: 'Upload failed. Please try again.',
  ERROR_QUOTA_EXCEEDED: 'Not enough storage space. Remove some files and try again.',
  ERROR_CORS_BLOCKED: 'Upload blocked by storage configuration. Contact your administrator.',
  ERROR_SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again.',
  ERROR_TIMEOUT: 'Connection timeout. Check your network and try again.',
  ERROR_GENERIC: 'Something went wrong. Please try again.',
  
  // Actions
  ACTION_RETRY: 'Retry',
  ACTION_CANCEL: 'Cancel',
  ACTION_CLOSE: 'Close',
  ACTION_UPLOAD: 'Upload Files',
  ACTION_CREATE_LINK: 'Create Link',
  ACTION_REVOKE_LINK: 'Revoke Link',
  ACTION_COPY_LINK: 'Copy Link',
  ACTION_DELETE: 'Delete',
  ACTION_REMOVE: 'Remove',
  ACTION_EDIT: 'Edit',
  ACTION_SAVE: 'Save',
  ACTION_DOWNLOAD: 'Download',
  ACTION_REFRESH: 'Refresh',
  
  // Link management
  LINK_EXPIRES_IN: 'Expires in',
  LINK_EXPIRES_SOON: 'Expires soon',
  LINK_EXPIRES_NEVER: 'No expiration',
  LINK_EXPIRES_VALID: 'Active',
  LINK_REVOKE_CONFIRM: 'Anyone with this link will lose access. Are you sure?',
  LINK_COPY_SUCCESS: 'Link copied to clipboard',
  
  // Onboarding
  ONBOARDING_STEP_WELCOME: 'Welcome',
  ONBOARDING_STEP_CREDENTIALS: 'Connect Storage',
  ONBOARDING_STEP_UPLOAD: 'Upload Your First File',
  ONBOARDING_CHOOSE_SERVICE: 'Which cloud storage do you use?',
  ONBOARDING_ENTER_CREDENTIALS: 'Enter your storage credentials',
  ONBOARDING_SELECT_BUCKET: 'Select a bucket',
  ONBOARDING_READY_TO_UPLOAD: 'You\'re all set! Upload your first file.',
  
  // Dashboard labels
  DASHBOARD_FILES: 'Files',
  DASHBOARD_LINKS: 'Shared Links',
  DASHBOARD_STORAGE: 'Storage',
  DASHBOARD_TOTAL_FILES: 'Total Files',
  DASHBOARD_TOTAL_STORAGE: 'Total Storage',
  DASHBOARD_RECENT_UPLOADS: 'Recent Uploads',
  
  // Search
  SEARCH_PLACEHOLDER: 'Search files, links, folders...',
  SEARCH_FILES_ONLY: 'Searching files only',
  SEARCH_LINKS_ONLY: 'Searching links only',
  SEARCH_TRY_DIFFERENT: 'Try a different search or browse your files',
} as const

export type CopyKey = keyof typeof COPY

/**
 * Helper function to get copy by key with fallback to key name
 */
export function getCopy(key: CopyKey): string {
  return COPY[key] || key
}
