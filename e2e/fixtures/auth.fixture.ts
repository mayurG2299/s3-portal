// e2e/fixtures/auth.fixture.ts
import { test as base, Page, BrowserContext } from '@playwright/test'
import { AUTH_STATE } from '../helpers/seed-constants'

type AuthFixtures = {
  ownerContext: BrowserContext
  ownerPage: Page
  adminContext: BrowserContext
  adminPage: Page
  viewerContext: BrowserContext
  viewerPage: Page
}

export const test = base.extend<AuthFixtures>({
  ownerContext: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE.owner })
    await use(ctx)
    await ctx.close()
  },
  ownerPage: async ({ ownerContext }, use) => {
    const page = await ownerContext.newPage()
    await use(page)
    await page.close()
  },
  adminContext: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE.admin })
    await use(ctx)
    await ctx.close()
  },
  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage()
    await use(page)
    await page.close()
  },
  viewerContext: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: AUTH_STATE.viewer })
    await use(ctx)
    await ctx.close()
  },
  viewerPage: async ({ viewerContext }, use) => {
    const page = await viewerContext.newPage()
    await use(page)
    await page.close()
  },
})
