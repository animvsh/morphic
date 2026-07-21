import { SearchResults } from '@/lib/types'
import { sanitizeUrl } from '@/lib/utils'

import { BaseSearchProvider } from './base'

type MiniMaxOrganicResult = {
  title?: string
  link?: string
  snippet?: string
  date?: string
}

type MiniMaxSearchResponse = {
  organic?: MiniMaxOrganicResult[]
}

/**
 * Search provider backed by MiniMax's official Web MCP search endpoint.
 *
 * This deliberately maps the MCP response into Morphic's native SearchResults
 * contract so the original researcher, streamed tool states, citations, and
 * persistence pipeline remain unchanged.
 */
export class MiniMaxSearchProvider extends BaseSearchProvider {
  async search(
    query: string,
    maxResults: number = 10,
    _searchDepth: 'basic' | 'advanced' = 'basic',
    includeDomains: string[] = [],
    excludeDomains: string[] = []
  ): Promise<SearchResults> {
    const apiKey =
      process.env.MINIMAX_API_KEY ?? process.env.OPENAI_COMPATIBLE_API_KEY
    this.validateApiKey(apiKey, 'MINIMAX')

    const response = await fetch(
      'https://api.minimax.io/v1/coding_plan/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query })
      }
    )

    if (!response.ok) {
      console.error(
        `MiniMax Web MCP error: ${response.status} ${response.statusText}`
      )
      throw new Error('Search failed')
    }

    const data = (await response.json()) as MiniMaxSearchResponse
    const include = includeDomains.map(normalizeDomain)
    const exclude = excludeDomains.map(normalizeDomain)

    const results = rankCurrentIdentityResults(data.organic ?? [], query)
      .filter(
        (
          item
        ): item is Required<Pick<MiniMaxOrganicResult, 'title' | 'link'>> &
          MiniMaxOrganicResult => !!item.title && !!item.link
      )
      .filter(item => isAllowedDomain(item.link, include, exclude))
      .slice(0, Math.max(1, maxResults))
      .map(item => ({
        title: item.title,
        url: sanitizeUrl(item.link),
        content: [item.snippet, item.date].filter(Boolean).join('\n')
      }))

    return {
      query,
      results,
      images: [],
      number_of_results: results.length
    }
  }
}

const RANKING_STOP_WORDS = new Set([
  'company',
  'current',
  'founder',
  'latest',
  'linkedin',
  'the'
])

/**
 * MiniMax Web MCP sometimes ranks an old profile mention above a newer post
 * written by the exact person. For current identity queries, promote recent
 * first-party posts and results that contain the query's distinguishing terms.
 * The result set is unchanged; only its order is improved.
 */
export function rankCurrentIdentityResults(
  items: MiniMaxOrganicResult[],
  query: string
): MiniMaxOrganicResult[] {
  const quotedName = query.match(/["“]([^"”]+\s+[^"”]+)["”]/)?.[1]
  const isCurrentIdentityQuery =
    !!quotedName && /\b(current|latest|founder|company|20\d{2})\b/i.test(query)

  if (!isCurrentIdentityQuery) return items

  const nameSlug = quotedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const nameWords = new Set(quotedName.toLowerCase().split(/\s+/))
  const topicTerms = query
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(
      term =>
        term.length >= 4 &&
        !nameWords.has(term) &&
        !RANKING_STOP_WORDS.has(term) &&
        !/^20\d{2}$/.test(term)
    )

  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreIdentityResult(item, nameSlug, topicTerms ?? [])
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item)
}

function scoreIdentityResult(
  item: MiniMaxOrganicResult,
  nameSlug: string,
  topicTerms: string[]
): number {
  const haystack =
    `${item.title ?? ''} ${item.link ?? ''} ${item.snippet ?? ''}`.toLowerCase()
  let score = 0

  try {
    const path = new URL(item.link ?? '').pathname.toLowerCase()
    if (path.includes(`/posts/${nameSlug}-`)) score += 100
  } catch {
    // Invalid provider URLs are filtered later; they receive no author boost.
  }

  const topicMatches = topicTerms.filter(term => haystack.includes(term)).length
  score += topicMatches * 12
  if (topicTerms.length > 0 && topicMatches === 0) score -= 75
  score += recencyScore(item.date)
  return score
}

function recencyScore(date?: string): number {
  if (!date) return 0
  const relative = date.match(
    /(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/i
  )
  if (relative) {
    const value = Number(relative[1])
    const unit = relative[2].toLowerCase()
    const days =
      value *
      ({
        minute: 1 / 1440,
        hour: 1 / 24,
        day: 1,
        week: 7,
        month: 30,
        year: 365
      }[unit] ?? 365)
    if (days <= 14) return 30
    if (days <= 60) return 20
    if (days <= 180) return 10
    if (days <= 365) return 5
    return 0
  }

  const timestamp = Date.parse(date)
  if (Number.isNaN(timestamp)) return 0
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000)
  if (ageDays <= 14) return 30
  if (ageDays <= 60) return 20
  if (ageDays <= 180) return 10
  if (ageDays <= 365) return 5
  return 0
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
}

function isAllowedDomain(
  url: string,
  includeDomains: string[],
  excludeDomains: string[]
): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    const matches = (domain: string) =>
      hostname === domain || hostname.endsWith(`.${domain}`)

    if (excludeDomains.some(matches)) return false
    return includeDomains.length === 0 || includeDomains.some(matches)
  } catch {
    return false
  }
}
