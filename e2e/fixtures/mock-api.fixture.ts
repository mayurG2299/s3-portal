// e2e/fixtures/mock-api.fixture.ts
import { Page } from '@playwright/test'

export const MOCK_FILES = [
  { key: 'documents/report.pdf', name: 'report.pdf', size: 102400, lastModified: '2026-05-01T00:00:00Z', type: 'file' },
  { key: 'images/logo.png', name: 'logo.png', size: 20480, lastModified: '2026-05-02T00:00:00Z', type: 'file' },
  { key: 'documents/', name: 'documents', type: 'folder' },
]

export async function mockFilesAPI(page: Page) {
  await page.route('/api/files**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: MOCK_FILES, prefix: '' }),
      })
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
    } else {
      await route.continue()
    }
  })
  await page.route('/api/files/upload**', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ success: true, key: 'test-upload.txt' }) })
  })
  await page.route('/api/files/download**', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ url: 'https://mock.local/file.txt' }) })
  })
  await page.route('/api/files/recents**', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ files: MOCK_FILES.slice(0, 2) }) })
  })
}

// Mock the share API so tests don't need real Link DB records
export async function mockShareAPI(page: Page, scenario: 'ok' | 'expired' | 'password' | 'limit-reached' | 'no-download') {
  await page.route('/api/share/**', async (route) => {
    const responses = {
      ok: { status: 200, body: JSON.stringify({ fileName: 'report.pdf', allowDownload: true, allowPreview: true }) },
      expired: { status: 410, body: JSON.stringify({ error: 'This link has expired' }) },
      password: { status: 401, body: JSON.stringify({ requiresPassword: true }) },
      'limit-reached': { status: 410, body: JSON.stringify({ error: 'Download limit reached' }) },
      'no-download': { status: 200, body: JSON.stringify({ fileName: 'report.pdf', allowDownload: false, allowPreview: true }) },
    }
    const r = responses[scenario]
    await route.fulfill({ status: r.status, contentType: 'application/json', body: r.body })
  })
}
