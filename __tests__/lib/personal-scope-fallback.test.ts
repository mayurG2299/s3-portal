import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GET as credentialsGet } from '@/app/api/credentials/route'
import { GET as linksGet } from '@/app/api/links/route'

jest.mock('@/lib/db')
jest.mock('next-auth')

const mockSession = (userId: string, teamId?: string) => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: userId, teamId: teamId || null },
  })
}

describe('Personal-Scope Fallback API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns only personal credentials and sets flag if teamId is invalid', async () => {
    mockSession('user-1', 'team-x')
    ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([{ id: 'cred1', userId: 'user-1', teamId: null }])

    const req = { url: 'http://localhost/api/credentials?teamId=team-x' } as any
    const res = await credentialsGet(req)
    const json = await res.json()
    expect(json.personalScopeFallback).toBe(true)
    expect(json.credentials).toEqual([{ id: 'cred1', userId: 'user-1', teamId: null }])
  })

  it('returns only personal links and sets flag if teamId is invalid', async () => {
    mockSession('user-2', 'team-y')
    ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.link.findMany as jest.Mock).mockResolvedValue([{ id: 'link1', userId: 'user-2', file: { teamId: null, size: 123, name: 'f', contentType: 't' } }])

    const req = { url: 'http://localhost/api/links?teamId=team-y' } as any
    const res = await linksGet(req)
    const json = await res.json()
    expect(json.personalScopeFallback).toBe(true)
    expect(json.links[0].userId).toBe('user-2')
    expect(json.links[0].file.teamId).toBe(null)
  })

  it('returns team credentials and flag false if user is member', async () => {
    mockSession('user-3', 'team-z')
    ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ id: 'mem1', userId: 'user-3', teamId: 'team-z' })
    ;(prisma.aWSCredential.findMany as jest.Mock).mockResolvedValue([{ id: 'cred2', teamId: 'team-z' }])

    const req = { url: 'http://localhost/api/credentials?teamId=team-z' } as any
    const res = await credentialsGet(req)
    const json = await res.json()
    expect(json.personalScopeFallback).toBe(false)
    expect(json.credentials[0].teamId).toBe('team-z')
  })

  it('returns team links and flag false if user is member', async () => {
    mockSession('user-4', 'team-a')
    ;(prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ id: 'mem2', userId: 'user-4', teamId: 'team-a' })
    ;(prisma.link.findMany as jest.Mock).mockResolvedValue([{ id: 'link2', userId: 'user-4', file: { teamId: 'team-a', size: 123, name: 'f', contentType: 't' } }])

    const req = { url: 'http://localhost/api/links?teamId=team-a' } as any
    const res = await linksGet(req)
    const json = await res.json()
    expect(json.personalScopeFallback).toBe(false)
    expect(json.links[0].file.teamId).toBe('team-a')
  })
})
