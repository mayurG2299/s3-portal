// e2e/tests/auth.spec.ts
import { test, expect } from '../fixtures'
import { LoginPage } from '../page-objects/LoginPage'
import { RegisterPage } from '../page-objects/RegisterPage'
import { USERS } from '../helpers/seed-constants'

const UNIQUE = () => `e2e-reg-${Date.now()}@test.local`

test.describe('TC-AUTH: Authentication', () => {

  test('TC-AUTH-01: register with valid credentials', async ({ page }) => {
    const reg = new RegisterPage(page)
    await reg.goto()
    await reg.register(UNIQUE(), 'Valid@Test1234!')
    await page.waitForURL(/dashboard|login/, { timeout: 10000 })
    await expect(page).toHaveURL(/dashboard|login/)
  })

  test('TC-AUTH-02: weak passwords are blocked', async ({ page }) => {
    const reg = new RegisterPage(page)
    const weakPasswords = ['short', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoSpecialChar1', 'NoNumber!Abc']
    for (const pw of weakPasswords) {
      await reg.goto()
      await reg.register(UNIQUE(), pw)
      await expect(page).not.toHaveURL(/dashboard/)
    }
  })

  test('TC-AUTH-03: duplicate email is rejected', async ({ page }) => {
    const reg = new RegisterPage(page)
    await reg.goto()
    await reg.register(USERS.owner.email, 'Valid@Test1234!')
    await expect(page).not.toHaveURL(/dashboard/)
  })

  test('TC-AUTH-04: valid login redirects to dashboard', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(USERS.owner.email, USERS.owner.password)
    await page.waitForURL(/dashboard/, { timeout: 15000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('TC-AUTH-05: wrong password is rejected', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(USERS.owner.email, 'WrongPassword@99!')
    await expect(page).not.toHaveURL(/dashboard/)
  })

  test('TC-AUTH-06: unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/files')
    await expect(page).toHaveURL(/login/)
  })

  test('TC-AUTH-07: session persists across navigation', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto('http://localhost:3000/login')
    await page.getByLabel(/email/i).fill(USERS.owner.email)
    await page.getByLabel(/password/i).fill(USERS.owner.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15000 })
    await expect(page).toHaveURL(/dashboard/)
    await page.goto('http://localhost:3000/login')
    await page.goto('http://localhost:3000/dashboard')
    await expect(page).toHaveURL(/dashboard/)
    await ctx.close()
  })
})
