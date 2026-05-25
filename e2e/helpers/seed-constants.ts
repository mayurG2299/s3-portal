// e2e/helpers/seed-constants.ts
export const TEST_TEAM_NAME = 'E2E Test Team'
export const TEST_TEAM_SLUG = 'e2e-test-team'

export const USERS = {
  owner: { email: 'e2e-owner@test.local', password: 'Owner@Test1234!' },
  admin: { email: 'e2e-admin@test.local', password: 'Admin@Test1234!' },
  viewer: { email: 'e2e-viewer@test.local', password: 'Viewer@Test1234!' },
  noTeam: { email: 'e2e-noteam@test.local', password: 'NoTeam@Test1234!' },
} as const

export const ROLE_IDS = {
  owner: 'role_owner',
  admin: 'role_admin',
  viewer: 'role_viewer',
} as const

export const AUTH_STATE = {
  owner: 'e2e/.auth/owner.json',
  admin: 'e2e/.auth/admin.json',
  viewer: 'e2e/.auth/viewer.json',
} as const
