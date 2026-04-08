import fs from 'fs'
import path from 'path'

describe('PendingInvitesList client boundary', () => {
  test('declares a client component when using dashboard context hooks', () => {
    const filePath = path.join(process.cwd(), 'components/dashboard/PendingInvitesList.tsx')
    const source = fs.readFileSync(filePath, 'utf8')
    const firstMeaningfulLine = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)

    expect(source).toContain("useDashboard")
    expect(firstMeaningfulLine).toBe("'use client'")
  })
})