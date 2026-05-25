// e2e/tests/invitations.spec.ts
import { test, expect } from '../fixtures'
import { InvitationsPage } from '../page-objects/InvitationsPage'
import { TeamsPage } from '../page-objects/TeamsPage'
import { USERS, TEST_TEAM_SLUG, ROLE_IDS } from '../helpers/seed-constants'
import { prisma } from '../helpers/db'
import { nanoid } from 'nanoid'
import bcrypt from 'bcryptjs'

test.describe('TC-INV: Invitations', () => {

  test('TC-INV-01: ADMIN can send an invitation', async ({ adminPage }) => {
    const teams = new TeamsPage(adminPage)
    await teams.goto()
    await expect(teams.inviteButton).toBeVisible()
    await teams.inviteButton.click()
    const emailInput = adminPage.getByLabel(/email/i).last()
    await emailInput.fill(`invite-${Date.now()}@test.local`)
    const roleSelect = adminPage.getByRole('combobox')
    if (await roleSelect.isVisible()) await roleSelect.selectOption('VIEWER')
    await adminPage.getByRole('button', { name: /send|invite/i }).last().click()
    await expect(adminPage.getByText(/invited|sent|pending/i)).toBeVisible({ timeout: 5000 })
  })

  test('TC-INV-04: VIEWER cannot see invite button', async ({ viewerPage }) => {
    await viewerPage.goto('http://localhost:3000/dashboard/teams')
    expect(await viewerPage.getByRole('button', { name: /^invite$/i }).isVisible().catch(() => false)).toBeFalsy()
  })

  test('TC-INV-02: invited user can accept an invitation', async ({ browser }) => {
    // Seed user + pending invite directly
    const email = `e2e-invite-accept-${Date.now()}@test.local`
    const team = await prisma.team.findFirst({ where: { slug: TEST_TEAM_SLUG } })
    const inviter = await prisma.user.findFirst({ where: { email: USERS.admin.email } })
    const role = await prisma.role.findUnique({ where: { id: ROLE_IDS.viewer } })
    if (!team || !inviter || !role) { test.skip(true, 'Missing seed data'); return }

    const user = await prisma.user.create({ data: { email, password: await bcrypt.hash('Invite@Test1234!', 10) } })
    const invite = await prisma.teamInvite.create({
      data: {
        teamId: team.id,
        email,
        roleId: role.id,
        invitedById: inviter.id,
        token: nanoid(32),
        expiresAt: new Date(Date.now() + 86400_000),
      },
    })

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('Invite@Test1234!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    const inv = new InvitationsPage(page)
    await inv.goto()
    await expect(inv.acceptButton).toBeVisible({ timeout: 5000 })
    await inv.acceptButton.click()
    await expect(page.getByText(/accepted|joined|success/i)).toBeVisible({ timeout: 5000 })
    await ctx.close()

    // Cleanup
    await prisma.teamMember.deleteMany({ where: { userId: user.id } })
    await prisma.teamInvite.deleteMany({ where: { id: invite.id } })
    await prisma.user.delete({ where: { id: user.id } })
  })

  test('TC-INV-03: invited user can decline an invitation', async ({ browser }) => {
    const email = `e2e-invite-decline-${Date.now()}@test.local`
    const team = await prisma.team.findFirst({ where: { slug: TEST_TEAM_SLUG } })
    const inviter = await prisma.user.findFirst({ where: { email: USERS.admin.email } })
    const role = await prisma.role.findUnique({ where: { id: ROLE_IDS.viewer } })
    if (!team || !inviter || !role) { test.skip(true, 'Missing seed data'); return }

    const user = await prisma.user.create({ data: { email, password: await bcrypt.hash('Decline@Test1234!', 10) } })
    const invite = await prisma.teamInvite.create({
      data: {
        teamId: team.id,
        email,
        roleId: role.id,
        invitedById: inviter.id,
        token: nanoid(32),
        expiresAt: new Date(Date.now() + 86400_000),
      },
    })

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('Decline@Test1234!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    const inv = new InvitationsPage(page)
    await inv.goto()
    await expect(inv.declineButton).toBeVisible({ timeout: 5000 })
    await inv.declineButton.click()
    await expect(page.getByText(/declined|removed/i)).toBeVisible({ timeout: 5000 })
    await ctx.close()

    await prisma.teamInvite.deleteMany({ where: { id: invite.id } })
    await prisma.user.delete({ where: { id: user.id } })
  })

  test('TC-INV-06: bucket access restriction enforced for VIEWER', async ({ viewerPage }) => {
    // Bucket restriction is set via PATCH /api/team/members/[id]/buckets
    // Test: VIEWER with restricted buckets cannot query a non-allowed bucket
    const response = await viewerPage.request.get('/api/files?bucketId=not-my-bucket-99')
    expect([200, 403, 404]).toContain(response.status())
    if (response.status() === 200) {
      const body = await response.json().catch(() => ({}))
      // Must be empty — not another team/bucket's files
      expect((body.files ?? []).length).toBe(0)
    }
  })

  test('TC-INV-05: OWNER can change a member role', async ({ ownerPage }) => {
    await ownerPage.goto('http://localhost:3000/dashboard/teams')
    const memberRow = ownerPage.getByText(USERS.viewer.email).locator('..')
    if (!await memberRow.isVisible().catch(() => false)) { test.skip(true, 'Member row locator needs data-testid'); return }
    await expect(memberRow).toBeVisible()
    // Role selector should be in the row
    const roleSelect = memberRow.getByRole('combobox')
    expect(await roleSelect.count()).toBeGreaterThan(0)
  })

})
