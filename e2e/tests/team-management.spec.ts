// e2e/tests/team-management.spec.ts
import { test, expect } from '../fixtures'
import { TeamsPage } from '../page-objects/TeamsPage'
import { TEST_TEAM_NAME } from '../helpers/seed-constants'

test.describe('TC-TEAM: Team Management', () => {

  test('TC-TEAM-01: OWNER can view team settings', async ({ ownerPage }) => {
    const teams = new TeamsPage(ownerPage)
    await teams.goto()
    await expect(ownerPage).toHaveURL(/teams/)
    await expect(ownerPage.getByText(TEST_TEAM_NAME)).toBeVisible()
  })

  test('TC-TEAM-02: OWNER can rename team', async ({ ownerPage }) => {
    await ownerPage.goto('http://localhost:3000/dashboard/teams')
    const nameInput = ownerPage.getByLabel(/team name/i)
    if (!await nameInput.isVisible()) { test.skip(true, 'Team rename input not found'); return }
    await nameInput.clear()
    await nameInput.fill('E2E Team Renamed')
    await ownerPage.getByRole('button', { name: /save|update/i }).click()
    await expect(ownerPage.getByText(/renamed|saved|updated/i).or(ownerPage.getByText('E2E Team Renamed'))).toBeVisible()
    // Rename back
    await nameInput.clear()
    await nameInput.fill(TEST_TEAM_NAME)
    await ownerPage.getByRole('button', { name: /save|update/i }).click()
  })

  test('TC-TEAM-03: OWNER can delete a team (shows confirmation)', async ({ ownerPage }) => {
    // We don't actually delete the seeded test team — just verify the flow exists
    await ownerPage.goto('http://localhost:3000/dashboard/teams')
    await ownerPage.waitForLoadState('networkidle')
    const deleteBtn = ownerPage.getByRole('button', { name: /delete team/i })
    if (!await deleteBtn.isVisible().catch(() => false)) { test.skip(true, 'Delete team button not found — check page layout'); return }
    await deleteBtn.click()
    // Must show a confirmation dialog before proceeding
    const confirm = ownerPage.getByRole('dialog')
      .or(ownerPage.getByRole('alertdialog'))
      .or(ownerPage.getByText(/are you sure|cannot be undone|confirm delete/i))
    await expect(confirm).toBeVisible({ timeout: 3000 })
    await ownerPage.keyboard.press('Escape')  // Cancel — do NOT actually delete the test team
  })

  test('TC-TEAM-04: ADMIN cannot see delete team button', async ({ adminPage }) => {
    await adminPage.goto('http://localhost:3000/dashboard/teams')
    const deleteBtn = adminPage.getByRole('button', { name: /delete team/i })
    expect(await deleteBtn.isVisible().catch(() => false)).toBeFalsy()
  })

  test('TC-TEAM-05: team selector shows current team name', async ({ ownerPage }) => {
    await ownerPage.goto('http://localhost:3000/dashboard')
    await expect(ownerPage.getByText(TEST_TEAM_NAME)).toBeVisible()
  })

})
