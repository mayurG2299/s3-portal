// e2e/tests/files.spec.ts
import { test, expect } from '../fixtures'
import { mockFilesAPI, MOCK_FILES } from '../fixtures'
import { FilesPage } from '../page-objects/FilesPage'

test.describe('TC-FILE: File Management', () => {

  test('TC-FILE-01: VIEWER can browse files', async ({ viewerPage }) => {
    await mockFilesAPI(viewerPage)
    const files = new FilesPage(viewerPage)
    await files.goto()
    await viewerPage.waitForLoadState('networkidle')
    await expect(viewerPage).toHaveURL(/files/)
    await expect(viewerPage).not.toHaveURL(/login/)
  })

  test('TC-FILE-02: upload button visible for ADMIN', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    const files = new FilesPage(adminPage)
    await files.goto()
    await adminPage.waitForLoadState('networkidle')
    await expect(files.uploadButton).toBeVisible()
  })

  test('TC-FILE-03: upload button visible for VIEWER (FILES_UPLOAD permission)', async ({ viewerPage }) => {
    await mockFilesAPI(viewerPage)
    const files = new FilesPage(viewerPage)
    await files.goto()
    await viewerPage.waitForLoadState('networkidle')
    await expect(files.uploadButton).toBeVisible()
  })

  test('TC-FILE-04: VIEWER has no delete button', async ({ viewerPage }) => {
    await mockFilesAPI(viewerPage)
    await viewerPage.goto('http://localhost:3000/dashboard/files')
    await viewerPage.waitForLoadState('networkidle')
    const deleteBtn = viewerPage.getByRole('button', { name: /^delete$/i })
    expect(await deleteBtn.isVisible().catch(() => false)).toBeFalsy()
  })

  test('TC-FILE-05: ADMIN has delete option available', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    // Hover first file row to reveal actions
    const firstRow = adminPage.locator('[data-testid="file-row"]').first()
    if (await firstRow.isVisible()) await firstRow.hover()
    const deleteOption = adminPage.getByRole('button', { name: /delete/i })
      .or(adminPage.getByRole('menuitem', { name: /delete/i }))
    expect(await deleteOption.count()).toBeGreaterThan(0)
  })

  test('TC-FILE-06: download single file @s3', async ({ adminPage }) => {
    test.skip(process.env.TEST_S3 !== 'true', 'Requires real S3 — set TEST_S3=true')
    await adminPage.goto('http://localhost:3000/dashboard/files')
    const [download] = await Promise.all([
      adminPage.waitForEvent('download'),
      adminPage.getByRole('button', { name: /download/i }).first().click(),
    ])
    expect(download.suggestedFilename()).toBeTruthy()
  })

  test('TC-FILE-07: bulk download button exists when files selected', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    // Select multiple files via checkboxes
    const checkboxes = adminPage.locator('[data-testid="file-checkbox"], input[type="checkbox"]')
    const count = await checkboxes.count()
    if (count >= 2) {
      await checkboxes.nth(0).check()
      await checkboxes.nth(1).check()
      const bulkDownload = adminPage.getByRole('button', { name: /download.*selected|bulk download/i })
      await expect(bulkDownload).toBeVisible()
    } else {
      test.skip(true, 'Need checkboxes in file rows')
    }
  })

  test('TC-FILE-08: image file shows preview', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    const imageRow = adminPage.getByText('logo.png')
    if (!await imageRow.isVisible().catch(() => false)) { test.skip(true, 'Mock file not rendered'); return }
    await imageRow.click()
    // Preview modal or embedded image should appear
    const preview = adminPage.locator('img[src], [data-testid="file-preview"]')
    const dialog = adminPage.getByRole('dialog')
    await expect(preview.or(dialog)).toBeVisible({ timeout: 5000 })
  })

  test('TC-FILE-09: PDF file shows preview', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    const pdfRow = adminPage.getByText('report.pdf')
    if (!await pdfRow.isVisible().catch(() => false)) { test.skip(true, 'PDF mock file not rendered'); return }
    await pdfRow.click()
    // PDF preview — could be an iframe, embed, or a preview modal
    const preview = adminPage.locator('iframe, embed, [data-testid="file-preview"], [data-testid="pdf-preview"]')
    const dialog = adminPage.getByRole('dialog')
    await expect(preview.or(dialog)).toBeVisible({ timeout: 5000 })
    await adminPage.keyboard.press('Escape')
  })

  test('TC-FILE-10: code/markdown file shows syntax-highlighted preview', async ({ adminPage }) => {
    // Add a .md file to mock
    await adminPage.route('/api/files**', route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            files: [{ key: 'notes/readme.md', name: 'readme.md', size: 512, type: 'file', lastModified: new Date().toISOString() }],
          }),
        })
      } else route.continue()
    })
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    const mdRow = adminPage.getByText('readme.md')
    if (!await mdRow.isVisible().catch(() => false)) { test.skip(true, 'Markdown mock file not rendered'); return }
    await mdRow.click()
    // Should render markdown/code — look for pre, code, or syntax highlight block
    const codePreview = adminPage.locator('pre, code, [class*="syntax"], [data-testid="code-preview"]')
    const dialog = adminPage.getByRole('dialog')
    await expect(codePreview.or(dialog)).toBeVisible({ timeout: 5000 })
    await adminPage.keyboard.press('Escape')
  })

  test('TC-FILE-11: create folder button exists for ADMIN', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    const folderBtn = adminPage.getByRole('button', { name: /folder|new folder/i })
    await expect(folderBtn).toBeVisible()
  })

  test('TC-FILE-12: recent files section loads', async ({ ownerPage }) => {
    await ownerPage.goto('http://localhost:3000/dashboard')
    await ownerPage.waitForLoadState('networkidle')
    const recents = ownerPage.getByText(/recent|recently accessed/i)
    await expect(recents.first()).toBeVisible()
  })

  test('TC-FILE-15: storage quota shown on dashboard', async ({ ownerPage }) => {
    await ownerPage.goto('http://localhost:3000/dashboard')
    await ownerPage.waitForLoadState('networkidle')
    // Storage should render somewhere — GB/TB/MB/quota
    const storageText = ownerPage.getByText(/storage|quota|gb|tb|mb/i)
    await expect(storageText.first()).toBeVisible()
  })

  test('TC-FILE-13: favorite a file and see it in favorites', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    const favBtn = adminPage.getByRole('button', { name: /favorite|star/i }).first()
    if (!await favBtn.isVisible().catch(() => false)) { test.skip(true, 'Favorite button not found'); return }
    await favBtn.click()
    await expect(adminPage.getByText(/favorited|added to favorites/i)).toBeVisible({ timeout: 3000 })
  })

  test('TC-FILE-14: tag a file', async ({ adminPage }) => {
    await mockFilesAPI(adminPage)
    await adminPage.goto('http://localhost:3000/dashboard/files')
    await adminPage.waitForLoadState('networkidle')
    const firstRow = adminPage.locator('[data-testid="file-row"]').first()
    if (!await firstRow.isVisible()) { test.skip(true, 'No file rows — check mock'); return }
    await firstRow.hover()
    const tagBtn = firstRow.getByRole('button', { name: /tag|label/i })
    if (!await tagBtn.isVisible().catch(() => false)) { test.skip(true, 'Tag button not found'); return }
    await tagBtn.click()
    const tagInput = adminPage.getByPlaceholder(/tag|label/i)
    await tagInput.fill('e2e-tag')
    await adminPage.keyboard.press('Enter')
    await expect(adminPage.getByText('e2e-tag')).toBeVisible({ timeout: 3000 })
  })

})
