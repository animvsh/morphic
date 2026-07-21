type EvidenceResult = {
  title: string
  url: string
  content: string
}

const PERSONAL_ACHIEVEMENT_PATTERN =
  /\b(hackathon|award|awarded|competition|prize|winner|winning|won|placed|track|teammates?)\b/i

const EVENT_SECTION_PATTERN =
  /\b(?:(?:cloud|edge|nemoclaw|best(?:\s+use\s+case)?(?:\s+for\s+ucsc)?)\s+)?track\s+winner\s*:/gi

export function extractAchievementPersonAnchor(
  searchContext?: string
): string | undefined {
  if (!searchContext || !PERSONAL_ACHIEVEMENT_PATTERN.test(searchContext)) {
    return undefined
  }

  const match = searchContext.match(
    /\b(?:what\s+did|did|has)\s+([\p{L}][\p{L}.'’-]*(?:\s+[\p{L}][\p{L}.'’-]*){1,3})\s+(?:win|won|build|do|place|participate)/iu
  )
  return match?.[1]?.trim()
}

export function isPersonAchievementSearch(searchContext?: string): boolean {
  return !!searchContext && PERSONAL_ACHIEVEMENT_PATTERN.test(searchContext)
}

/**
 * Company expansion is expensive and can contaminate unrelated identity
 * questions. Only run it when the user actually asks about company identity.
 */
export function shouldExpandIdentityCompanySearch(
  searchContext?: string
): boolean {
  if (!searchContext) return false
  return /\b(?:founder|co-?founder|what\s+company|company\s+does|currently\s+runs?|current\s+(?:company|startup|business|venture|product)|latest\s+(?:company|startup|business|venture|product))\b/i.test(
    searchContext
  )
}

/**
 * Long event pages often list several winners. Keep only the section that
 * actually contains the resolved person, and discard achievement results that
 * never name them. This prevents the model from joining adjacent teams.
 */
export function constrainIdentityAttributionResults<T extends EvidenceResult>(
  results: T[],
  person: string
): T[] {
  const normalizedPerson = person.toLowerCase()
  const personSlug = normalizedPerson.replace(/[^a-z0-9]+/g, '-')

  return results.flatMap(result => {
    const combined = `${result.title} ${result.content}`
    if (!PERSONAL_ACHIEVEMENT_PATTERN.test(combined)) return [result]

    const titleHasPerson = result.title.toLowerCase().includes(normalizedPerson)
    const contentIndex = result.content.toLowerCase().indexOf(normalizedPerson)
    const exactAuthor = isExactAuthorUrl(result.url, personSlug)

    if (!titleHasPerson && contentIndex < 0 && !exactAuthor) return []
    if (contentIndex < 0) return [result]

    const sectionStart = findLastSectionStart(result.content, contentIndex)
    const sectionEnd = findNextSectionStart(
      result.content,
      contentIndex + person.length
    )
    const start = sectionStart ?? Math.max(0, contentIndex - 320)
    const end =
      sectionEnd ??
      Math.min(result.content.length, contentIndex + person.length + 620)
    const evidenceWindow = result.content.slice(start, end).trim()

    return [
      {
        ...result,
        content: `Exact-person evidence window for ${person}: ${evidenceWindow}`
      }
    ]
  })
}

export async function enrichIdentityAttributionResults<
  T extends EvidenceResult
>(results: T[], person: string): Promise<T[]> {
  const authoritative = results
    .map((result, index) => ({ result, index }))
    .filter(
      ({ result }) =>
        PERSONAL_ACHIEVEMENT_PATTERN.test(
          `${result.title} ${result.content}`
        ) && isAuthoritativeEventUrl(result.url)
    )
    .slice(0, 3)

  const enriched = new Map<number, T>()
  await Promise.all(
    authoritative.map(async ({ result, index }) => {
      const pageText = await fetchPageText(result.url)
      if (pageText?.toLowerCase().includes(person.toLowerCase())) {
        enriched.set(index, { ...result, content: pageText })
      }
    })
  )

  return constrainIdentityAttributionResults(
    results.map((result, index) => enriched.get(index) ?? result),
    person
  )
}

function isAuthoritativeEventUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return hostname.endsWith('.edu') || hostname === 'ucsc.edu'
  } catch {
    return false
  }
}

async function fetchPageText(url: string): Promise<string | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Brok/1.0)',
        Accept: 'text/html,text/plain'
      }
    })
    if (!response.ok) return undefined
    const html = await response.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

function isExactAuthorUrl(url: string, personSlug: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().includes(`/posts/${personSlug}-`)
  } catch {
    return false
  }
}

function findLastSectionStart(
  content: string,
  beforeIndex: number
): number | undefined {
  const prefix = content.slice(0, beforeIndex)
  let lastStart: number | undefined
  EVENT_SECTION_PATTERN.lastIndex = 0
  for (const match of prefix.matchAll(EVENT_SECTION_PATTERN)) {
    if (typeof match.index === 'number') lastStart = match.index
  }
  return lastStart
}

function findNextSectionStart(
  content: string,
  afterIndex: number
): number | undefined {
  const suffix = content.slice(afterIndex)
  EVENT_SECTION_PATTERN.lastIndex = 0
  const next = EVENT_SECTION_PATTERN.exec(suffix)
  return next?.index === undefined ? undefined : afterIndex + next.index
}

export type IdentityResolution = {
  resolved_person: string
  current_company_candidate: string
  instruction: string
  candidate_evidence: Array<{
    company: string
    age_days: number | null
    url: string
    excerpt: string
  }>
}

export function buildIdentityResolution({
  person,
  candidates
}: {
  person: string
  candidates: Array<{ company: string; results: EvidenceResult[] }>
}): IdentityResolution | undefined {
  const personSlug = person.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const evidence = candidates.flatMap(({ company, results }) => {
    const exactAuthorResults = results.filter(result => {
      const mentionsCompany = `${result.title} ${result.url} ${result.content}`
        .toLowerCase()
        .includes(company.toLowerCase())
      if (!mentionsCompany) return false
      try {
        return new URL(result.url).pathname
          .toLowerCase()
          .includes(`/posts/${personSlug}-`)
      } catch {
        return false
      }
    })
    const ranked = exactAuthorResults
      .map(result => ({ result, ageDays: extractAgeDays(result.content) }))
      .sort(
        (a, b) =>
          (a.ageDays ?? Number.POSITIVE_INFINITY) -
          (b.ageDays ?? Number.POSITIVE_INFINITY)
      )
    const newest = ranked[0]
    if (!newest) return []

    return [
      {
        company,
        age_days: newest.ageDays,
        url: newest.result.url,
        excerpt: newest.result.content.slice(0, 600)
      }
    ]
  })

  const datedEvidence = evidence.filter(
    item => typeof item.age_days === 'number'
  )
  if (datedEvidence.length < 2) return undefined

  const current = [...datedEvidence].sort(
    (a, b) => a.age_days! - b.age_days!
  )[0]
  if (!current) return undefined

  return {
    resolved_person: person,
    current_company_candidate: current.company,
    instruction:
      'Use the newest exact-author evidence for current work. Treat older candidate labels as historical, omit unrequested old product descriptions, and cite the matching raw result below.',
    candidate_evidence: evidence.map(item =>
      item.company === current.company
        ? item
        : {
            ...item,
            excerpt:
              'Older exact-author company association. Historical product copy is intentionally omitted because the user asked for current work.'
          }
    )
  }
}

function extractAgeDays(content: string): number | null {
  const relative = content.match(
    /(?:^|\n|\s)(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago\b/i
  )
  if (relative) {
    const value = Number(relative[1])
    const unit = relative[2].toLowerCase()
    return (
      value *
      ({
        minute: 1 / 1440,
        hour: 1 / 24,
        day: 1,
        week: 7,
        month: 30,
        year: 365
      }[unit] ?? 365)
    )
  }

  const shorthand = content.match(/\b(\d+)\s*(d|w|mo|y)\b/i)
  if (!shorthand) return null
  const value = Number(shorthand[1])
  const unit = shorthand[2].toLowerCase()
  return value * ({ d: 1, w: 7, mo: 30, y: 365 }[unit] ?? 365)
}
