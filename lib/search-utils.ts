/**
 * Industry-standard search utilities
 * Implements fuzzy matching with Levenshtein distance and score-based ranking
 */

/**
 * Calculate Levenshtein distance between two strings (edit distance)
 * Used for typo tolerance in search queries
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Calculate relevance score for search matching
 * Higher scores = better match
 * 
 * Scoring:
 * - Exact match: 1000
 * - Prefix match: 500
 * - Contains match: 300
 * - Fuzzy match (edit distance ≤ 2): 100 - (distance * 20)
 * - Tag match: 200
 */
export function calculateRelevanceScore(
  query: string,
  target: string,
  options: {
    isTitle?: boolean
    isTag?: boolean
    maxEditDistance?: number
  } = {}
): number {
  const { isTitle = false, isTag = false, maxEditDistance = 2 } = options
  
  const lowerQuery = query.toLowerCase().trim()
  const lowerTarget = target.toLowerCase().trim()

  // Exact match (highest priority)
  if (lowerTarget === lowerQuery) {
    return 1000 * (isTitle ? 1.5 : 1)
  }

  // Prefix match (very relevant)
  if (lowerTarget.startsWith(lowerQuery)) {
    return 500 * (isTitle ? 1.5 : 1)
  }

  // Contains match (relevant)
  if (lowerTarget.includes(lowerQuery)) {
    return 300 * (isTitle ? 1.5 : 1)
  }

  // Tag match (medium relevance)
  if (isTag && lowerTarget.includes(lowerQuery)) {
    return 200
  }

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(lowerQuery, lowerTarget)
  if (distance <= maxEditDistance) {
    return Math.max(0, 100 - distance * 20)
  }

  // Check if query words appear in target
  const queryWords = lowerQuery.split(/\\s+/)
  const targetWords = lowerTarget.split(/\\s+/)
  
  let wordMatchScore = 0
  for (const qWord of queryWords) {
    for (const tWord of targetWords) {
      if (tWord.includes(qWord)) {
        wordMatchScore += 50
      } else {
        const wordDistance = levenshteinDistance(qWord, tWord)
        if (wordDistance <= 1) {
          wordMatchScore += 30
        }
      }
    }
  }

  return wordMatchScore
}

/**
 * Search and rank results by relevance
 */
export interface SearchItem {
  id: string
  title: string
  subtitle?: string
  tags?: string[]
  description?: string | null
  [key: string]: any
}

export interface RankedSearchResult<T extends SearchItem> {
  item: T
  score: number
  matchedField: 'title' | 'subtitle' | 'tag' | 'description'
  matchedValue?: string
}

export function searchAndRank<T extends SearchItem>(
  query: string,
  items: T[],
  options: {
    scoreThreshold?: number
    maxResults?: number
  } = {}
): RankedSearchResult<T>[] {
  const { scoreThreshold = 10, maxResults = 50 } = options

  if (!query.trim()) {
    return []
  }

  const results: RankedSearchResult<T>[] = []

  for (const item of items) {
    let bestScore = 0
    let matchedField: 'title' | 'subtitle' | 'tag' | 'description' = 'title'
    let matchedValue: string | undefined

    // Score title
    const titleScore = calculateRelevanceScore(query, item.title, { isTitle: true })
    if (titleScore > bestScore) {
      bestScore = titleScore
      matchedField = 'title'
      matchedValue = item.title
    }

    // Score subtitle
    if (item.subtitle) {
      const subtitleScore = calculateRelevanceScore(query, item.subtitle)
      if (subtitleScore > bestScore) {
        bestScore = subtitleScore
        matchedField = 'subtitle'
        matchedValue = item.subtitle
      }
    }

    // Score tags
    if (item.tags && item.tags.length > 0) {
      for (const tag of item.tags) {
        const tagScore = calculateRelevanceScore(query, tag, { isTag: true })
        if (tagScore > bestScore) {
          bestScore = tagScore
          matchedField = 'tag'
          matchedValue = tag
        }
      }
    }

    // Score description
    if (item.description) {
      const descScore = calculateRelevanceScore(query, item.description)
      if (descScore > bestScore) {
        bestScore = descScore
        matchedField = 'description'
        matchedValue = item.description
      }
    }

    if (bestScore >= scoreThreshold) {
      results.push({
        item,
        score: bestScore,
        matchedField,
        matchedValue
      })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, maxResults)
}

/**
 * Highlight matched portions of text for UI display
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()

  // Find all occurrences
  const parts: string[] = []
  let lastIndex = 0

  let index = lowerText.indexOf(lowerQuery)
  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index))
    }
    // Add highlighted match
    parts.push(`<mark class="bg-yellow-200 dark:bg-yellow-900 font-semibold">${text.substring(index, index + lowerQuery.length)}</mark>`)
    lastIndex = index + lowerQuery.length
    index = lowerText.indexOf(lowerQuery, lastIndex)
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.join('')
}
