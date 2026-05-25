import { Page, Locator } from '@playwright/test'

export class DashboardPage {
  readonly storageUsage: Locator
  readonly fileCount: Locator
  readonly teamStats: Locator

  constructor(private page: Page) {
    this.storageUsage = page.getByText(/storage|gb|tb|mb|used/i)
    this.fileCount = page.getByText(/files|file count/i)
    this.teamStats = page.getByText(/members|team size/i)
  }

  async goto() { await this.page.goto('http://localhost:3000/dashboard') }

  async getFileCount(): Promise<number> {
    const text = await this.fileCount.textContent().catch(() => '0')
    const match = text.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }
}
