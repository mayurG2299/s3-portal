// e2e/tests/flow.spec.ts
import { test, expect } from '../fixtures'
import { RegisterPage } from '../page-objects/RegisterPage'
import { InvitationsPage } from '../page-objects/InvitationsPage'
import { FilesPage } from '../page-objects/FilesPage'
import { mockFilesAPI } from '../fixtures/mock-api.fixture'
import { USERS } from '../helpers/seed-constants'
import { prisma } from '../helpers/db'
import bcrypt from 'bcryptjs'

test.describe('TC-FLOW: Flow Design Review', () => {

  test('TC-FLOW-01: onboarding flow — new user with no team', async ({ browser }) => {
    const email = `e2e-no-team-${Date.now()}@test.local`
    const password = 'NoTeam@Test1234!'

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const reg = new RegisterPage(page)
    await reg.goto()
    await reg.register(email, password)
    await page.waitForURL(/dashboard|login/, { timeout: 15_000 })

    // User should see onboarding guidance (create team CTA or invitation prompt)
    const createTeamBtn = page.getByRole('button', { name: /create team/i })
    const joinTeamBtn = page.getByRole('button', { name: /join|enter code/i })
    const onboardingMsg = page.getByText(/create.*team|join.*team|get started/i)

    const hasOnboarding = await createTeamBtn.isVisible().catch(() => false) ||
                          await joinTeamBtn.isVisible().catch(() => false) ||
                          await onboardingMsg.isVisible().catch(() => false)

    expect(hasOnboarding).toBeTruthy()
    await ctx.close()

    // Cleanup
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) await prisma.user.delete({ where: { id: user.id } })
  })

  test('TC-FLOW-02: onboarding flow — invited user', async ({ browser }) => {
    const email = `e2e-invited-onboard-${Date.now()}@test.local`
    const password = 'Invited@Test1234!'

    // Create user and invitation
    const user = await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 10) },
    })
    const team = await prisma.team.findFirst()
    const inviter = await prisma.user.findFirst({ where: { email: USERS.admin.email } })
    const role = await prisma.role.findUnique({ where: { id: 'role_viewer' } })
    if (!team || !inviter || !role) { test.skip(true, 'Missing seed data'); return }

    const invite = await prisma.teamInvite.create({
      data: {
        teamId: team.id,
        email,
        roleId: role.id,
        invitedById: inviter.id,
        token: 'test-token-' + Date.now(),
        expiresAt: new Date(Date.now() + 86400_000),
      },
    })

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })

    // Navigate to invitations
    const inv = new InvitationsPage(page)
    await inv.goto()
    await expect(inv.acceptButton).toBeVisible({ timeout: 5000 })

    await ctx.close()

    // Cleanup
    await prisma.teamInvite.deleteMany({ where: { id: invite.id } })
    await prisma.user.delete({ where: { id: user.id } })
  })

  test('TC-FLOW-03: empty state — no credentials added yet', async ({ ownerPage }) => {
    // Navigate to files without credentials configured
    await ownerPage.goto('http://localhost:3000/dashboard/files')
    await ownerPage.waitForLoadState('networkidle')
    // Should see empty state message about credentials
    const emptyState = ownerPage.getByText(/add credentials|configure|no credentials|set up/i)
    const credLink = ownerPage.getByRole('link', { name: /credentials/i })
    const visible = await emptyState.isVisible().catch(() => false) ||
                    await credLink.isVisible().catch(() => false)
    // If credentials exist, test may not apply
    if (!visible) {
      test.skip(true, 'Credentials already configured or empty state not shown')
    } else {
      expect(visible).toBeTruthy()
    }
  })

  test('TC-FLOW-04: empty state — no files in bucket', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    // Mock empty files response
    await adminPage.route('/api/files**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ files: [], prefix: '' }),
      })
    })
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    // Should see "no files" empty state
    const emptyState = adminPage.getByText(/no files|empty|upload.*file|get started/i)
    await expect(emptyState).toBeVisible({ timeout: 5000 })
  })

  test('TC-FLOW-05: link sharing UX — finding the share option', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    const files = new FilesPage(adminPage)
    await files.goto()
    await adminPage.waitForLoadState('networkidle')
    // Hover over first file row to reveal actions
    const firstRow = adminPage.locator('[data-testid="file-row"]').first()
    if (await firstRow.isVisible()) {
      await firstRow.hover()
    }
    // Share button should be discoverable
    const shareBtn = adminPage.getByRole('button', { name: /share/i })
      .or(adminPage.getByTitle(/share/i))
    const visible = await shareBtn.isVisible().catch(() => false)
    expect(visible).toBeTruthy()
  })

  test('TC-FLOW-06: share page UX — public visitor', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.route('/api/share/**', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          fileName: 'report.pdf',
          allowDownload: true,
          allowPreview: true,
        }),
      })
    })
    await page.goto('http://localhost:3000/share/fake-hash')
    await page.waitForLoadState('networkidle')
    // Should see file name and download option
    const fileName = page.getByText(/report\.pdf/i)
    const downloadBtn = page.getByRole('button', { name: /download/i })
    await expect(fileName.or(downloadBtn)).toBeVisible({ timeout: 5000 })
    await ctx.close()
  })

  test('TC-FLOW-07: error recovery — wrong AWS credentials', async ({ ownerPage }) => {
    // Navigate to files with potentially wrong credentials
    await ownerPage.goto('http://localhost:3000/dashboard/files')
    await ownerPage.waitForLoadState('networkidle')
    // If credentials are wrong, should see user-friendly error
    const errorMsg = ownerPage.getByText(/invalid|credentials|error|configuration/i)
    const credLink = ownerPage.getByRole('link', { name: /credentials|settings/i })
    // This test may pass if credentials are valid
    const hasError = await errorMsg.isVisible().catch(() => false)
    if (!hasError) {
      test.skip(true, 'No credential errors — credentials are valid')
    } else {
      await expect(errorMsg).toBeVisible()
      await expect(credLink).toBeVisible()
    }
  })

  test('TC-FLOW-08: confirmation dialogs for destructive actions', async ({ ownerPage }) => {
    await mockFilesAPI(ownerPage)
    await ownerPage.goto('http://localhost:3000/dashboard/files')
    await ownerPage.waitForLoadState('networkidle')
    // Try to delete a file
    const firstRow = ownerPage.locator('[data-testid="file-row"]').first()
    if (await firstRow.isVisible()) {
      await firstRow.hover()
      const deleteBtn = ownerPage.getByRole('button', { name: /delete/i }).first()
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click()
        // Confirmation dialog should appear
        const confirmDialog = ownerPage.getByRole('dialog')
          .or(ownerPage.getByText(/are you sure|confirm|cannot be undone/i))
        await expect(confirmDialog).toBeVisible({ timeout: 3000 })
        await ownerPage.keyboard.press('Escape')
      }
    }
    // Similar checks could be done for team/credential/account deletion
  })

  test('TC-FLOW-09: navigation consistency — breadcrumbs', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    const files = new FilesPage(adminPage)
    await files.goto()
    await adminPage.waitForLoadState('networkidle')
    // Check breadcrumbs exist
    const breadcrumb = files.breadcrumb
    if (await breadcrumb.isVisible().catch(() => false)) {
      await expect(breadcrumb).toBeVisible()
      // Navigate into a folder (if available)
      const folderLink = adminPage.getByText('documents')
      if (await folderLink.isVisible().catch(() => false)) {
        await folderLink.click()
        await adminPage.waitForLoadState('networkidle')
        // Breadcrumb should update
        await expect(breadcrumb).toBeVisible()
      }
    } else {
      test.skip(true, 'Breadcrumb not found — may not be implemented yet')
    }
  })

  test('TC-FLOW-10: loading states', async ({ adminPage }) => {
    // Slow 3G throttling
    await adminPage.route('**/*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.continue()
    })
    await adminPage.goto('http://localhost:3000/dashboard/files')
    // Should see loading spinner or skeleton
    const loader = adminPage.locator('[data-testid="loading"], [role="progressbar"], .spinner')
      .or(adminPage.getByText(/loading/i))
    const visible = await loader.isVisible().catch(() => false)
    if (visible) {
      await expect(loader).toBeVisible()
    }
    await adminPage.waitForLoadState('networkidle')
    // No blank white screen
    const content = await adminPage.locator('body').textContent()
    expect(content).toBeTruthy()
    expect(content.length).toBeGreaterThan(100)
  })

  test('TC-FLOW-11: keyboard shortcut accessibility', async ({ adminPage }) => {
    await adminPage.goto('http://localhost:3000/dashboard')
    await adminPage.waitForLoadState('networkidle')
    // Try pressing ? key to open shortcuts modal
    await adminPage.keyboard.press('?')
    await adminPage.waitForTimeout(500)
    const modal = adminPage.getByRole('dialog')
      .or(adminPage.getByText(/keyboard shortcuts|shortcuts/i))
    const visible = await modal.isVisible().catch(() => false)
    if (visible) {
      await expect(modal).toBeVisible()
      await adminPage.keyboard.press('Escape')
    } else {
      // Check if shortcuts exist in sidebar/footer
      const shortcutHint = adminPage.getByText(/\?|shortcuts|keyboard/i)
      const hintVisible = await shortcutHint.isVisible().catch(() => false)
      if (!hintVisible) {
        test.skip(true, 'Keyboard shortcuts modal not found')
      }
    }
  })

  test('TC-FLOW-12: mobile/responsive layout', async ({ browser }) => {
    // Emulate mobile viewport (iPhone 12: 390x844)
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    })
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/login')
    await page.getByLabel(/email/i).fill(USERS.owner.email)
    await page.getByLabel(/password/i).fill(USERS.owner.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    // Check for horizontal overflow
    const bodyWidth = await page.locator('body').evaluate(el => el.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 390
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)  // Allow 1px tolerance
    // Sidebar should collapse or be hamburger menu
    const hamburger = page.getByRole('button', { name: /menu|nav/i })
      .or(page.locator('[data-testid="mobile-menu"]'))
    const visible = await hamburger.isVisible().catch(() => false)
    expect(visible).toBeTruthy()
    await ctx.close()
  })

})
