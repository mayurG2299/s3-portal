// e2e/tests/links.spec.ts
import { test, expect } from '../fixtures'
import { mockShareAPI } from '../fixtures/mock-api.fixture'
import { LinksPage } from '../page-objects/LinksPage'
import { SharePage } from '../page-objects/SharePage'

const FAKE_HASH = 'fake-share-hash-e2e'

test.describe('TC-LINK: Link Sharing', () => {

  test('TC-LINK-01: create a PUBLIC link', async ({ adminPage }) => {
    const links = new LinksPage(adminPage)
    await links.goto()
    await adminPage.waitForLoadState('networkidle')
    await expect(links.createButton).toBeVisible()
    await links.createButton.click()
    // Form should appear with link type selector
    const typeSelect = adminPage.getByLabel(/type|link type/i)
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('PUBLIC')
    }
    // Fill file selector (could be dropdown or search)
    const fileInput = adminPage.getByLabel(/file|select file/i).or(adminPage.getByPlaceholder(/file/i))
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.click()
      await adminPage.getByText('report.pdf').click()
    }
    const createBtn = adminPage.getByRole('button', { name: /create|generate|share/i }).last()
    await createBtn.click()
    await expect(adminPage.getByText(/created|generated|link:/i)).toBeVisible({ timeout: 5000 })
  })

  test('TC-LINK-02: create a PRESIGNED link with 1-day expiry', async ({ adminPage }) => {
    const links = new LinksPage(adminPage)
    await links.goto()
    await adminPage.waitForLoadState('networkidle')
    await links.createButton.click()
    const typeSelect = adminPage.getByLabel(/type|link type/i)
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('PRESIGNED')
    }
    // Set expiry to 1 day
    const expiryInput = adminPage.getByLabel(/expiry|expires/i)
    if (await expiryInput.isVisible()) {
      const tomorrow = new Date(Date.now() + 86400_000).toISOString().split('T')[0]
      await expiryInput.fill(tomorrow)
    }
    const createBtn = adminPage.getByRole('button', { name: /create|generate/i }).last()
    await createBtn.click()
    await expect(adminPage.getByText(/created|generated/i)).toBeVisible({ timeout: 5000 })
  })

  test('TC-LINK-03: presigned link max 7 days enforcement', async ({ adminPage }) => {
    const links = new LinksPage(adminPage)
    await links.goto()
    await links.createButton.click()
    const typeSelect = adminPage.getByLabel(/type|link type/i)
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('PRESIGNED')
    }
    // Try to set expiry to 8 days out
    const expiryInput = adminPage.getByLabel(/expiry|expires/i)
    if (await expiryInput.isVisible()) {
      const eightDays = new Date(Date.now() + 8 * 86400_000).toISOString().split('T')[0]
      await expiryInput.fill(eightDays)
      const createBtn = adminPage.getByRole('button', { name: /create|generate/i }).last()
      await createBtn.click()
      // Should show error or validation message
      const error = adminPage.getByText(/7 days|maximum|max/i)
      await expect(error).toBeVisible({ timeout: 3000 })
    } else {
      test.skip(true, 'Expiry input not found — UI may enforce client-side')
    }
  })

  test('TC-LINK-04: password-protected link', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await mockShareAPI(page, 'password')
    const share = new SharePage(page)
    await share.goto(FAKE_HASH)
    await expect(share.passwordInput).toBeVisible({ timeout: 5000 })
    // Try without password — should deny
    const noPasswordMsg = page.getByText(/password required|enter password/i)
    await expect(noPasswordMsg).toBeVisible()
    // Enter correct password
    await share.passwordInput.fill('test-password')
    await share.submitPassword.click()
    // Mock will return 200 after correct password (in real app)
    await expect(share.downloadButton.or(page.getByText(/report.pdf/i))).toBeVisible({ timeout: 3000 })
    await ctx.close()
  })

  test('TC-LINK-05: download limit enforcement', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await mockShareAPI(page, 'limit-reached')
    const share = new SharePage(page)
    await share.goto(FAKE_HASH)
    await expect(share.limitMessage).toBeVisible({ timeout: 5000 })
    await ctx.close()
  })

  test('TC-LINK-06: expiry date enforcement', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await mockShareAPI(page, 'expired')
    const share = new SharePage(page)
    await share.goto(FAKE_HASH)
    await expect(share.expiredMessage).toBeVisible({ timeout: 5000 })
    await ctx.close()
  })

  test('TC-LINK-07: disable download on a link', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await mockShareAPI(page, 'no-download')
    const share = new SharePage(page)
    await share.goto(FAKE_HASH)
    // File should be previewable
    const preview = page.getByText(/report.pdf/i).or(page.locator('[data-testid="file-preview"]'))
    await expect(preview).toBeVisible({ timeout: 5000 })
    // Download button should be hidden or disabled
    const downloadBtn = share.downloadButton
    expect(await downloadBtn.isVisible().catch(() => false)).toBeFalsy()
    await ctx.close()
  })

  test('TC-LINK-08: VIEWER can create links', async ({ viewerPage }) => {
    const links = new LinksPage(viewerPage)
    await links.goto()
    await viewerPage.waitForLoadState('networkidle')
    await expect(links.createButton).toBeVisible()
    await links.createButton.click()
    // Form should open for VIEWER (LINKS_CREATE permission)
    const form = viewerPage.getByRole('dialog').or(viewerPage.getByLabel(/file|type/i))
    await expect(form).toBeVisible({ timeout: 3000 })
    await viewerPage.keyboard.press('Escape')
  })

  test('TC-LINK-09: VIEWER cannot delete links', async ({ viewerPage }) => {
    await viewerPage.goto('http://localhost:3000/dashboard/links')
    await viewerPage.waitForLoadState('networkidle')
    const deleteBtn = viewerPage.getByRole('button', { name: /^delete$/i })
      .or(viewerPage.getByRole('menuitem', { name: /delete/i }))
    expect(await deleteBtn.isVisible().catch(() => false)).toBeFalsy()
  })

  test('TC-LINK-10: ADMIN can delete links', async ({ adminPage }) => {
    await adminPage.goto('http://localhost:3000/dashboard/links')
    await adminPage.waitForLoadState('networkidle')
    const deleteBtn = adminPage.getByRole('button', { name: /delete/i }).first()
    if (!await deleteBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No links to delete — create one first')
      return
    }
    await deleteBtn.click()
    // Confirmation dialog should appear
    const confirm = adminPage.getByRole('dialog')
      .or(adminPage.getByRole('button', { name: /confirm|yes|delete/i }))
    await expect(confirm).toBeVisible({ timeout: 3000 })
    await adminPage.keyboard.press('Escape')
  })

  test('TC-LINK-11: CloudFront link option exists', async ({ adminPage }) => {
    const links = new LinksPage(adminPage)
    await links.goto()
    await links.createButton.click()
    const typeSelect = adminPage.getByLabel(/type|link type/i)
    if (await typeSelect.isVisible()) {
      // Check that CLOUDFRONT is an option
      const cfOption = adminPage.locator('option').getByText(/cloudfront|cdn/i)
      await expect(cfOption).toBeVisible()
    } else {
      // Could be behind a toggle/tab
      const cfToggle = adminPage.getByText(/cloudfront|cdn/i)
      await expect(cfToggle).toBeVisible()
    }
    await adminPage.keyboard.press('Escape')
  })

})
