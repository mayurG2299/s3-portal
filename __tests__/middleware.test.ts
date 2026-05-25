/** @jest-environment node */

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }))

import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

describe('middleware stale token handling', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to /dashboard when roleLevel is null on an admin-only route', async () => {
    ;(getToken as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      roleLevel: null,
      teamId: 't1',
    })
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://localhost/dashboard/admin/audit')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('allows through when roleLevel meets requirement', async () => {
    ;(getToken as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'test@test.com',
      roleLevel: 100,
      teamId: 't1',
    })
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('http://localhost/dashboard/admin/audit')
    const res = await middleware(req)
    expect(res.status).not.toBe(307)
  })
})
