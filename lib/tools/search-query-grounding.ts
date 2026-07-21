const IDENTITY_QUESTION_PATTERN =
  /\b(who\s+is|profile|biography|bio\b|founder|co-?founder|current\s+(?:company|work|role)|works?\s+(?:at|for)|person\s+named)\b/i

const CURRENT_WORK_PATTERN =
  /\b(current|currently|latest|today|now|still|company|startup|product|project|founder|co-?founder)\b/i

const NAME_STOP_WORDS = new Set([
  'and',
  'at',
  'but',
  'company',
  'current',
  'currently',
  'do',
  'does',
  'for',
  'from',
  'his',
  'her',
  'latest',
  'only',
  'their',
  'what',
  'where',
  'which',
  'who',
  'whose',
  'work'
])

function cleanNameCandidate(candidate: string): string | undefined {
  const words = candidate
    .replace(/[“”"'(),?:]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const kept: string[] = []
  for (const word of words) {
    if (NAME_STOP_WORDS.has(word.toLowerCase())) break
    if (!/^[\p{L}][\p{L}.'’-]*$/u.test(word)) break
    kept.push(word)
    if (kept.length === 4) break
  }

  return kept.length >= 2 ? kept.join(' ') : undefined
}

export function extractPersonAnchor(
  searchContext?: string
): string | undefined {
  if (!searchContext || !IDENTITY_QUESTION_PATTERN.test(searchContext)) {
    return undefined
  }

  const explicitPatterns = [
    /\bwho\s+is\s+([^\n.!?]+)/i,
    /\bperson\s+named\s+([^\n.!?]+)/i,
    /\b(?:profile|biography|bio)\s+(?:of|for|on)\s+([^\n.!?]+)/i
  ]

  for (const pattern of explicitPatterns) {
    const match = searchContext.match(pattern)
    const candidate = match?.[1] ? cleanNameCandidate(match[1]) : undefined
    if (candidate) return candidate
  }

  // Fall back to a conventional multi-word proper name. This intentionally
  // requires title case so ordinary nouns do not become identity anchors.
  const titleCaseName = searchContext.match(
    /\b([A-Z][\p{L}.'’-]+(?:\s+[A-Z][\p{L}.'’-]+){1,3})\b/u
  )?.[1]

  return titleCaseName ? cleanNameCandidate(titleCaseName) : undefined
}

const COMPANY_CANDIDATE_STOP_WORDS = new Set([
  'ai',
  'company',
  'founders',
  'inc',
  'project',
  'startup',
  'the',
  'ucsc'
])

export function extractIdentityCompanyCandidates(evidence: string[]): string[] {
  const candidates: string[] = []
  const patterns = [
    /\bfounder\s*(?:@|at|of)\s*([a-z][a-z0-9.-]{1,30})/gi,
    /\b(?:built|building|runs?|started)\s+([a-z][a-z0-9.-]{1,30})/gi
  ]

  for (const text of evidence) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0
      for (const match of text.matchAll(pattern)) {
        const candidate = match[1]?.toLowerCase().replace(/[.-]+$/, '')
        if (
          candidate &&
          !COMPANY_CANDIDATE_STOP_WORDS.has(candidate) &&
          !candidates.includes(candidate)
        ) {
          candidates.push(candidate)
        }
        if (candidates.length === 4) return candidates
      }
    }
  }

  return candidates
}

/**
 * Keeps searches for ambiguous companies/projects attached to the exact person
 * in the user's question. Search models often shorten a query to a generic
 * brand name, which can silently pull results for a different company.
 */
export function groundIdentitySearchQuery({
  query,
  searchContext,
  currentYear = new Date().getUTCFullYear()
}: {
  query: string
  searchContext?: string
  currentYear?: number
}): string {
  const personAnchor = extractPersonAnchor(searchContext)
  if (!personAnchor) return query

  let groundedQuery = query.trim()
  const normalizedQuery = groundedQuery.toLocaleLowerCase()
  const normalizedAnchor = personAnchor.toLocaleLowerCase()
  const quotedAnchorPattern = new RegExp(
    `["“]${personAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["”]`,
    'i'
  )

  if (!quotedAnchorPattern.test(groundedQuery)) {
    groundedQuery = `${groundedQuery} "${personAnchor}"`
  }

  const needsRecency =
    CURRENT_WORK_PATTERN.test(searchContext ?? '') ||
    CURRENT_WORK_PATTERN.test(query)
  const hasRecency =
    /\b(current|currently|latest|today|now|recent|20\d{2})\b/i.test(
      groundedQuery
    )

  if (needsRecency && !hasRecency) {
    groundedQuery = `${groundedQuery} current ${currentYear}`
  }

  const queryWithoutAnchor = normalizedQuery
    .replace(normalizedAnchor, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  const isBroadIdentityLookup = queryWithoutAnchor.split(/\s+/).length <= 4

  if (needsRecency && isBroadIdentityLookup) {
    if (!/\bfounder\b/i.test(groundedQuery)) groundedQuery += ' founder'
    if (!/\bcompany\b/i.test(groundedQuery)) groundedQuery += ' company'
    if (!/\blatest\b/i.test(groundedQuery)) groundedQuery += ' latest'
  }

  return groundedQuery
}
