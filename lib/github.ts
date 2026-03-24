/**
 * GitHub metadata helpers for public repository information used in the landing page.
 */

export const REPO = 'mayurG2299/s3-portal'

interface GitHubRepoResponse {
  stargazers_count?: number
}

/**
 * Fetches the GitHub stargazer count for a repository.
 * Returns 0 when the API request fails or the response is invalid.
 *
 * @param repo GitHub repository in owner/name format.
 * @returns The stargazer count or 0 on failure.
 */
export async function getGitHubStars(repo: string = REPO): Promise<number> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      next: { revalidate: 3600 },
      headers: {
        Accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
      },
    })

    if (!res.ok) return 0

    const data = (await res.json()) as GitHubRepoResponse
    return data.stargazers_count ?? 0
  } catch {
    return 0
  }
}
