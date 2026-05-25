/** @jest-environment node */

describe('custom role level cap', () => {
  function brokenGetRoleLevel(editCount: number): number {
    return Math.max(20, Math.min(80, 20 + editCount * 3))
  }

  it('CONFIRMS BUG: current formula allows level >= 50 (above or equal to ADMIN)', () => {
    expect(brokenGetRoleLevel(20)).toBeGreaterThanOrEqual(50)
  })

  function fixedGetRoleLevel(editCount: number): number {
    return Math.max(20, Math.min(49, 20 + editCount * 3))
  }

  it('fixed formula never exceeds 49 (below ADMIN=50)', () => {
    expect(fixedGetRoleLevel(0)).toBe(20)
    expect(fixedGetRoleLevel(5)).toBe(35)
    expect(fixedGetRoleLevel(10)).toBe(49)
    expect(fixedGetRoleLevel(20)).toBe(49)
    expect(fixedGetRoleLevel(20)).toBeLessThan(50)
  })
})
