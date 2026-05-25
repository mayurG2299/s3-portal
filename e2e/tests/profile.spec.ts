// e2e/tests/profile.spec.ts
import { test, expect } from '../fixtures'
import { ProfilePage } from '../page-objects/ProfilePage'
import { LoginPage } from '../page-objects/LoginPage'
import { USERS } from '../helpers/seed-constants'
import { prisma } from '../helpers/db'
import bcrypt from 'bcryptjs'

test.describe('TC-PROF: Profile & Account', () => {

  test('TC-PROF-01: change password', async ({ browser }) => {
    // Create a temporary user for this test
    const email = `e2e-pwd-change-${Date.now()}@test.local`
    const oldPassword = 'OldPassword@1234!'
    const newPassword = 'NewPassword@5678!'

    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(oldPassword, 10),
      },
    })

    // Log in with old password
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email, oldPassword)
    await page.waitForURL(/dashboard/, { timeout: 15_000 })

    // Change password
    const profile = new ProfilePage(page)
    await profile.goto()
    await page.waitForLoadState('networkidle')
    await profile.currentPasswordInput.fill(oldPassword)
    await profile.newPasswordInput.fill(newPassword)
    await profile.savePasswordButton.click()
    await expect(profile.successMessage).toBeVisible({ timeout: 5000 })

    // Log out
    await page.goto('http://localhost:3000/api/auth/signout')
    await page.waitForURL(/login|signout/, { timeout: 5000 })

    // Try to log in with old password — should fail
    await login.goto()
    await login.login(email, oldPassword)
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/dashboard')

    // Log in with new password — should succeed
    await login.goto()
    await login.login(email, newPassword)
    await page.waitForURL(/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/dashboard/)

    await ctx.close()

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } })
  })

  test('TC-PROF-02: change to weak password', async ({ adminPage }) => {
    const profile = new ProfilePage(adminPage)
    await profile.goto()
    await adminPage.waitForLoadState('networkidle')
    await profile.currentPasswordInput.fill(USERS.admin.password)
    await profile.newPasswordInput.fill('weak')
    await profile.savePasswordButton.click()
    // Should see error
    await expect(profile.errorMessage).toBeVisible({ timeout: 3000 })
    // Password should NOT be changed
    const currentUrl = adminPage.url()
    expect(currentUrl).toContain('/profile')
  })

  test('TC-PROF-03: delete account', async ({ browser }) => {
    // Create a temporary user to delete
    const email = `e2e-delete-${Date.now()}@test.local`
    const password = 'Delete@Test1234!'

    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
      },
    })

    // Log in
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const login = new LoginPage(page)
    await login.goto()
    await login.login(email, password)
    await page.waitForURL(/dashboard/, { timeout: 15_000 })

    // Delete account
    const profile = new ProfilePage(page)
    await profile.goto()
    await page.waitForLoadState('networkidle')
    await profile.deleteAccountButton.click()
    // Confirm deletion
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i }).last()
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }
    // Should redirect to login
    await page.waitForURL(/login|register/, { timeout: 10_000 })
    await expect(page).toHaveURL(/login|register/)

    await ctx.close()

    // Verify account is deleted — cannot log back in
    const deletedUser = await prisma.user.findUnique({ where: { id: user.id } })
    expect(deletedUser).toBeNull()
  })

})
