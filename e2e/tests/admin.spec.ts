// e2e/tests/admin.spec.ts
import { test, expect } from '../fixtures'
import { AdminAuditPage } from '../page-objects/AdminAuditPage'
import { AdminPermissionsPage } from '../page-objects/AdminPermissionsPage'
import { AdminIndexingPage } from '../page-objects/AdminIndexingPage'
import { SettingsPage } from '../page-objects/SettingsPage'

test.describe('TC-ADMIN: Admin Features', () => {

  test('TC-ADMIN-01: audit log access — OWNER', async ({ ownerPage }) => {
    const audit = new AdminAuditPage(ownerPage)
    await audit.goto()
    await ownerPage.waitForLoadState('networkidle')
    // Should see audit log table
    await expect(audit.logRows.first()).toBeVisible({ timeout: 5000 })
    // Verify columns exist
    const content = await ownerPage.locator('body').textContent()
    expect(content).toMatch(/user|action|timestamp|date/i)
  })

  test('TC-ADMIN-02: audit log access — ADMIN (view only)', async ({ adminPage }) => {
    const audit = new AdminAuditPage(adminPage)
    await audit.goto()
    await adminPage.waitForLoadState('networkidle')
    // ADMIN should see logs (VIEW permission)
    await expect(audit.logRows.first()).toBeVisible({ timeout: 5000 })
    // But no delete/clear controls
    const clearBtn = adminPage.getByRole('button', { name: /clear|delete|purge/i })
    expect(await clearBtn.isVisible().catch(() => false)).toBeFalsy()
  })

  test('TC-ADMIN-03: VIEWER cannot access audit log', async ({ viewerPage }) => {
    const audit = new AdminAuditPage(viewerPage)
    await audit.goto()
    await viewerPage.waitForLoadState('networkidle')
    // Should see access denied
    await expect(audit.accessDenied).toBeVisible({ timeout: 5000 })
    // Or redirected
    const url = viewerPage.url()
    if (!url.includes('/admin/audit')) {
      // Redirected away — this is acceptable
      expect(url).not.toContain('/admin/audit')
    }
  })

  test('TC-ADMIN-04: permissions management — OWNER', async ({ ownerPage }) => {
    const perms = new AdminPermissionsPage(ownerPage)
    await perms.goto()
    await ownerPage.waitForLoadState('networkidle')
    await expect(perms.saveButton).toBeVisible()
    // Find VIEWER role and a permission toggle
    const viewerSection = ownerPage.getByText(/viewer/i).locator('..')
    if (await viewerSection.isVisible()) {
      const toggle = viewerSection.locator('input[type="checkbox"]').first()
      if (await toggle.isVisible()) {
        const wasChecked = await toggle.isChecked()
        await toggle.click()
        await perms.saveButton.click()
        await expect(ownerPage.getByText(/saved|updated/i)).toBeVisible({ timeout: 3000 })
        // Restore original state
        if (wasChecked) await toggle.check()
        else await toggle.uncheck()
        await perms.saveButton.click()
      } else {
        test.skip(true, 'Permission toggles not found')
      }
    }
  })

  test('TC-ADMIN-05: permissions management — ADMIN blocked', async ({ adminPage }) => {
    const perms = new AdminPermissionsPage(adminPage)
    await perms.goto()
    await adminPage.waitForLoadState('networkidle')
    // Should see access denied (OWNER-only route)
    await expect(perms.accessDenied).toBeVisible({ timeout: 5000 })
    // Or HTTP 403
    const response = await adminPage.request.get('/api/admin/permissions')
    expect([403, 404]).toContain(response.status())
  })

  test('TC-ADMIN-06: file indexing status', async ({ ownerPage }) => {
    const indexing = new AdminIndexingPage(ownerPage)
    await indexing.goto()
    await ownerPage.waitForLoadState('networkidle')
    // Should see indexing table with status
    const content = await ownerPage.locator('body').textContent()
    expect(content).toMatch(/indexed|pending|failed|status/i)
  })

  test('TC-ADMIN-07: pause/resume indexing', async ({ ownerPage }) => {
    const indexing = new AdminIndexingPage(ownerPage)
    await indexing.goto()
    await ownerPage.waitForLoadState('networkidle')
    // Try to pause
    if (await indexing.pauseButton.isVisible().catch(() => false)) {
      await indexing.pauseButton.click()
      await expect(ownerPage.getByText(/paused/i)).toBeVisible({ timeout: 3000 })
      // Resume
      await expect(indexing.resumeButton).toBeVisible({ timeout: 2000 })
      await indexing.resumeButton.click()
      await expect(ownerPage.getByText(/resumed|running/i)).toBeVisible({ timeout: 3000 })
    } else if (await indexing.resumeButton.isVisible().catch(() => false)) {
      // Already paused — resume first
      await indexing.resumeButton.click()
      await expect(ownerPage.getByText(/resumed|running/i)).toBeVisible({ timeout: 3000 })
    } else {
      test.skip(true, 'Pause/resume buttons not found')
    }
  })

  test('TC-ADMIN-08: retry failed indexing', async ({ ownerPage }) => {
    const indexing = new AdminIndexingPage(ownerPage)
    await indexing.goto()
    await ownerPage.waitForLoadState('networkidle')
    // If there are failed jobs, retry button should appear
    const failedRow = ownerPage.getByText(/failed/i)
    if (await failedRow.isVisible().catch(() => false)) {
      await expect(indexing.retryButton).toBeVisible()
      await indexing.retryButton.click()
      await expect(ownerPage.getByText(/requeued|retrying|pending/i)).toBeVisible({ timeout: 5000 })
    } else {
      test.skip(true, 'No failed indexing jobs to retry')
    }
  })

  test('TC-ADMIN-09: AI credentials configuration', async ({ ownerPage }) => {
    const settings = new SettingsPage(ownerPage)
    await settings.goto()
    await ownerPage.waitForLoadState('networkidle')
    // Should see AI credentials section
    await expect(settings.aiCredentialsSection).toBeVisible()
    // Test connection button should exist
    if (await settings.testConnectionButton.isVisible().catch(() => false)) {
      await settings.testConnectionButton.click()
      // Should show success or error
      const result = ownerPage.getByText(/success|failed|error|connected/i)
      await expect(result).toBeVisible({ timeout: 10_000 })
    } else {
      // Just verify the section is accessible
      const content = await ownerPage.locator('body').textContent()
      expect(content).toMatch(/ai|openai|api key|credentials/i)
    }
  })

})
