// e2e/global-setup.ts
import { chromium, FullConfig } from '@playwright/test'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { prisma, deleteTestData } from './helpers/db'
import { USERS, TEST_TEAM_NAME, TEST_TEAM_SLUG, ROLE_IDS, AUTH_STATE } from './helpers/seed-constants'

async function globalSetup(config: FullConfig) {
  fs.mkdirSync(path.resolve('e2e/.auth'), { recursive: true })

  await deleteTestData()

  // Hash all passwords in parallel
  const [ownerHash, adminHash, viewerHash, noTeamHash] = await Promise.all([
    bcrypt.hash(USERS.owner.password, 10),
    bcrypt.hash(USERS.admin.password, 10),
    bcrypt.hash(USERS.viewer.password, 10),
    bcrypt.hash(USERS.noTeam.password, 10),
  ])

  // Create users
  const [ownerUser, adminUser, viewerUser] = await Promise.all([
    prisma.user.create({ data: { email: USERS.owner.email, password: ownerHash } }),
    prisma.user.create({ data: { email: USERS.admin.email, password: adminHash } }),
    prisma.user.create({ data: { email: USERS.viewer.email, password: viewerHash } }),
    prisma.user.create({ data: { email: USERS.noTeam.email, password: noTeamHash } }),
  ])

  // Team requires ownerId
  const team = await prisma.team.create({
    data: {
      name: TEST_TEAM_NAME,
      slug: TEST_TEAM_SLUG,
      ownerId: ownerUser.id,
    },
  })

  // Storage quota — field is limitBytes
  await prisma.storageQuota.create({
    data: {
      teamId: team.id,
      limitBytes: BigInt(1099511627776),  // 1 TB
    },
  })

  // Add members
  await Promise.all([
    prisma.teamMember.create({ data: { userId: ownerUser.id, teamId: team.id, roleId: ROLE_IDS.owner } }),
    prisma.teamMember.create({ data: { userId: adminUser.id, teamId: team.id, roleId: ROLE_IDS.admin } }),
    prisma.teamMember.create({ data: { userId: viewerUser.id, teamId: team.id, roleId: ROLE_IDS.viewer } }),
  ])

  // Save browser auth sessions — real login so NextAuth session cookies are valid
  const browser = await chromium.launch()
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3000'

  const sessions: [keyof typeof USERS, string][] = [
    ['owner', AUTH_STATE.owner],
    ['admin', AUTH_STATE.admin],
    ['viewer', AUTH_STATE.viewer],
  ]

  for (const [role, stateFile] of sessions) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`${baseURL}/login`)
    await page.getByLabel(/email/i).fill(USERS[role].email)
    await page.getByLabel(/password/i).fill(USERS[role].password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15_000 })
    await ctx.storageState({ path: stateFile })
    await ctx.close()
    console.log(`✅ Auth state saved for ${role}`)
  }

  await browser.close()
  await prisma.$disconnect()
}

export default globalSetup
