// e2e/tests/credentials.spec.ts
import { test, expect } from '../fixtures'
import { CredentialsPage } from '../page-objects/CredentialsPage'

test.describe('TC-CRED: Credentials', () => {

  test('TC-CRED-01: ADMIN sees add credential button', async ({ adminPage }) => {
    const creds = new CredentialsPage(adminPage)
    await creds.goto()
    await adminPage.waitForLoadState('networkidle')
    await expect(creds.addButton).toBeVisible()
  })

  test('TC-CRED-02: VIEWER — credential secrets not shown in full', async ({ viewerPage }) => {
    await viewerPage.goto('http://localhost:3000/dashboard/credentials')
    await viewerPage.waitForLoadState('networkidle')
    const content = await viewerPage.locator('body').textContent() ?? ''
    // Real AWS secret keys are 40 alphanumeric chars — should not appear
    expect(/[A-Za-z0-9+/]{40,}/.test(content)).toBeFalsy()
  })

  test('TC-CRED-03: VIEWER has no add/edit/delete controls', async ({ viewerPage }) => {
    const creds = new CredentialsPage(viewerPage)
    await creds.goto()
    await viewerPage.waitForLoadState('networkidle')
    for (const btn of [creds.addButton, creds.editButton, creds.deleteButton]) {
      expect(await btn.isVisible().catch(() => false)).toBeFalsy()
    }
  })

  test('TC-CRED-04: ADMIN can open edit credential form', async ({ adminPage }) => {
    await adminPage.goto('http://localhost:3000/dashboard/credentials')
    await adminPage.waitForLoadState('networkidle')
    const editBtn = adminPage.getByRole('button', { name: /edit/i }).first()
    if (!await editBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No credentials seeded — create one first to test edit')
      return
    }
    await editBtn.click()
    await expect(adminPage.getByRole('dialog').or(adminPage.getByLabel(/credential name/i))).toBeVisible()
  })

  test('TC-CRED-05: OWNER can open delete credential confirmation', async ({ ownerPage }) => {
    await ownerPage.goto('http://localhost:3000/dashboard/credentials')
    await ownerPage.waitForLoadState('networkidle')
    const deleteBtn = ownerPage.getByRole('button', { name: /delete/i }).first()
    if (!await deleteBtn.isVisible().catch(() => false)) {
      test.skip(true, 'No credentials to delete')
      return
    }
    await deleteBtn.click()
    // Must show a confirmation dialog
    const dialog = ownerPage.getByRole('dialog').or(ownerPage.getByText(/are you sure|confirm/i))
    await expect(dialog).toBeVisible()
    await ownerPage.keyboard.press('Escape')
  })

  test('TC-CRED-06: CloudFront fields visible in credential form', async ({ adminPage }) => {
    await adminPage.goto('http://localhost:3000/dashboard/credentials')
    await adminPage.waitForLoadState('networkidle')
    const addBtn = adminPage.getByRole('button', { name: /add|create|new credential/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    // CloudFront fields should appear in the form
    const cfField = adminPage.getByLabel(/cloudfront|cdn|distribution/i)
    if (await cfField.isVisible()) {
      await expect(cfField).toBeVisible()
    } else {
      // Could be behind a toggle/tab
      const cfToggle = adminPage.getByText(/cloudfront|cdn/i)
      await expect(cfToggle).toBeVisible()
    }
    await adminPage.keyboard.press('Escape')
  })

})
