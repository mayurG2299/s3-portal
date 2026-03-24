import { getGitHubStars } from '@/lib/github'

describe('getGitHubStars', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('returns star count for successful GitHub API response', async () => {
    const mockJson = jest.fn().mockResolvedValue({ stargazers_count: 19330 })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: mockJson } as unknown as Response)

    const stars = await getGitHubStars('octocat/Hello-World')

    expect(stars).toBe(19330)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/octocat/Hello-World',
      expect.objectContaining({
        next: { revalidate: 3600 },
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
        }),
      })
    )
  })

  it('returns 0 when GitHub API response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false } as unknown as Response)

    const stars = await getGitHubStars('octocat/Hello-World')

    expect(stars).toBe(0)
  })

  it('returns 0 when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network failure'))

    const stars = await getGitHubStars('octocat/Hello-World')

    expect(stars).toBe(0)
  })
})
