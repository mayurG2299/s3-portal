import { ScreenName, PermissionLevel } from '@prisma/client'

/**
 * Screen/Feature permission constants
 * These define what screens/features users can access
 */
export const SCREENS = {
  // Files management
  FILES_LIST: 'FILES_LIST' as ScreenName,
  FILES_UPLOAD: 'FILES_UPLOAD' as ScreenName,
  FILES_DELETE: 'FILES_DELETE' as ScreenName,
  FILES_SHARE: 'FILES_SHARE' as ScreenName,

  // Credentials management
  CREDENTIALS_LIST: 'CREDENTIALS_LIST' as ScreenName,
  CREDENTIALS_CREATE: 'CREDENTIALS_CREATE' as ScreenName,
  CREDENTIALS_EDIT: 'CREDENTIALS_EDIT' as ScreenName,
  CREDENTIALS_DELETE: 'CREDENTIALS_DELETE' as ScreenName,

  // Team management
  TEAM_SETTINGS: 'TEAM_SETTINGS' as ScreenName,
  TEAM_MEMBERS: 'TEAM_MEMBERS' as ScreenName,
  TEAM_INVITATIONS: 'TEAM_INVITATIONS' as ScreenName,
  TEAM_DELETE: 'TEAM_DELETE' as ScreenName,

  // Links management
  LINKS_LIST: 'LINKS_LIST' as ScreenName,
  LINKS_CREATE: 'LINKS_CREATE' as ScreenName,
  LINKS_DELETE: 'LINKS_DELETE' as ScreenName,

  // Admin features
  ADMIN_AUDIT_LOG: 'ADMIN_AUDIT_LOG' as ScreenName,
  ADMIN_SETTINGS: 'ADMIN_SETTINGS' as ScreenName,
} as const

/**
 * Default screen permissions by role name
 * Users with these roles get these default permissions automatically
 * NOTE: This is deprecated. Use RolePermission database records instead.
 */
export const DEFAULT_SCREEN_PERMISSIONS: Record<string, ScreenName[]> = {
  OWNER: [
    // OWNER gets access to everything
    SCREENS.FILES_LIST,
    SCREENS.FILES_UPLOAD,
    SCREENS.FILES_DELETE,
    SCREENS.FILES_SHARE,
    SCREENS.CREDENTIALS_LIST,
    SCREENS.CREDENTIALS_CREATE,
    SCREENS.CREDENTIALS_EDIT,
    SCREENS.CREDENTIALS_DELETE,
    SCREENS.TEAM_SETTINGS,
    SCREENS.TEAM_MEMBERS,
    SCREENS.TEAM_INVITATIONS,
    SCREENS.TEAM_DELETE,
    SCREENS.LINKS_LIST,
    SCREENS.LINKS_CREATE,
    SCREENS.LINKS_DELETE,
    SCREENS.ADMIN_AUDIT_LOG,
    SCREENS.ADMIN_SETTINGS,
  ],
  ADMIN: [
    // ADMIN gets most features except team deletion and admin settings
    SCREENS.FILES_LIST,
    SCREENS.FILES_UPLOAD,
    SCREENS.FILES_DELETE,
    SCREENS.FILES_SHARE,
    SCREENS.CREDENTIALS_LIST,
    SCREENS.CREDENTIALS_CREATE,
    SCREENS.CREDENTIALS_EDIT,
    SCREENS.CREDENTIALS_DELETE,
    SCREENS.TEAM_SETTINGS,
    SCREENS.TEAM_MEMBERS,
    SCREENS.TEAM_INVITATIONS,
    SCREENS.LINKS_LIST,
    SCREENS.LINKS_CREATE,
    SCREENS.LINKS_DELETE,
    SCREENS.ADMIN_AUDIT_LOG,
  ],
  VIEWER: [
    // VIEWER gets basic read and some write access
    SCREENS.FILES_LIST,
    SCREENS.FILES_UPLOAD,
    SCREENS.FILES_SHARE,
    SCREENS.CREDENTIALS_LIST,
    SCREENS.LINKS_LIST,
    SCREENS.LINKS_CREATE,
  ],
}

/**
 * Permission level hierarchy
 */
const PERMISSION_LEVEL_HIERARCHY: Record<PermissionLevel, number> = {
  VIEW: 1,
  EDIT: 2,
}

export function hasPermissionLevel(
  userLevel: PermissionLevel | undefined,
  requiredLevel: PermissionLevel
): boolean {
  if (!userLevel) return false
  return PERMISSION_LEVEL_HIERARCHY[userLevel] >= PERMISSION_LEVEL_HIERARCHY[requiredLevel]
}

/**
 * Check if a permission level is VIEW or higher
 */
export function canViewScreen(permissionLevel: PermissionLevel | undefined): boolean {
  return hasPermissionLevel(permissionLevel, 'VIEW')
}

/**
 * Check if a permission level is EDIT or higher
 */
export function canEditScreen(permissionLevel: PermissionLevel | undefined): boolean {
  return hasPermissionLevel(permissionLevel, 'EDIT')
}
