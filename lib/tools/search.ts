import { type JSONValue, tool, UIToolInvocation } from 'ai'

import { getSearchSchemaForModel } from '@/lib/schema/search'
import { SearchResults } from '@/lib/types'
import {
  getGeneralSearchProviderType,
  getSearchToolDescription
} from '@/lib/utils/search-config'
import { getBaseUrlString } from '@/lib/utils/url'
import { logToolPayload } from '@/lib/utils/usage-logging'

import {
  createSearchProvider,
  DEFAULT_PROVIDER,
  SearchProviderType
} from './search/providers'
import type { IdentityResolution } from './identity-resolution'
import {
  buildIdentityResolution,
  constrainIdentityAttributionResults,
  enrichIdentityAttributionResults,
  extractAchievementPersonAnchor,
  isPersonAchievementSearch,
  shouldExpandIdentityCompanySearch
} from './identity-resolution'
import {
  extractIdentityCompanyCandidates,
  extractPersonAnchor,
  groundIdentitySearchQuery
} from './search-query-grounding'

/**
 * Creates a search tool with the appropriate schema for the given model.
 */
export function createSearchTool(
  fullModel: string,
  searchContext?: string,
  onIdentityResolution?: (resolution: IdentityResolution) => void
) {
  let identityExpansionClaimed = false

  return tool({
    description: getSearchToolDescription(),
    inputSchema: getSearchSchemaForModel(fullModel),
    async *execute(
      {
        query,
        type = 'optimized',
        content_types = ['web'],
        max_results = 20,
        search_depth = 'basic', // Default for standard schema
        include_domains = [],
        exclude_domains = []
      },
      context
    ) {
      const filledQuery = groundIdentitySearchQuery({ query, searchContext })
      const personAnchor =
        extractPersonAnchor(searchContext) ??
        extractAchievementPersonAnchor(searchContext)
      const shouldExpandIdentityCompanies =
        !identityExpansionClaimed &&
        !!personAnchor &&
        shouldExpandIdentityCompanySearch(searchContext)
      if (shouldExpandIdentityCompanies) identityExpansionClaimed = true

      // Show the exact query sent to the provider so the research trail is
      // honest and users can see when identity grounding was applied.
      yield {
        state: 'searching' as const,
        query: filledQuery
      }
      // Ensure max_results is at least 10
      const minResults = 10
      const effectiveMaxResults = Math.max(
        max_results || minResults,
        minResults
      )
      const effectiveSearchDepth = search_depth as 'basic' | 'advanced'

      let searchResult: SearchResults

      // Determine which provider to use based on type
      let searchAPI: SearchProviderType
      if (type === 'general') {
        // Try to use dedicated general search provider
        const generalProvider = getGeneralSearchProviderType()
        if (generalProvider) {
          searchAPI = generalProvider
        } else {
          // Fallback to primary provider (optimized search provider)
          searchAPI =
            (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER
          console.log(
            `[Search] type="general" requested but no dedicated provider available, using optimized search provider: ${searchAPI}`
          )
        }
      } else {
        // For 'optimized', use the configured provider
        searchAPI =
          (process.env.SEARCH_API as SearchProviderType) || DEFAULT_PROVIDER
      }

      const effectiveSearchDepthForAPI =
        searchAPI === 'searxng' &&
        process.env.SEARXNG_DEFAULT_DEPTH === 'advanced'
          ? 'advanced'
          : effectiveSearchDepth || 'basic'

      console.log(
        `Using search API: ${searchAPI}, Type: ${type}, Search Depth: ${effectiveSearchDepthForAPI}`
      )

      try {
        if (
          searchAPI === 'searxng' &&
          effectiveSearchDepthForAPI === 'advanced'
        ) {
          // Get the base URL using the centralized utility function
          const baseUrl = await getBaseUrlString()

          const response = await fetch(`${baseUrl}/api/advanced-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: filledQuery,
              maxResults: effectiveMaxResults,
              searchDepth: effectiveSearchDepthForAPI,
              includeDomains: include_domains,
              excludeDomains: exclude_domains
            })
          })
          if (!response.ok) {
            throw new Error(
              `Advanced search API error: ${response.status} ${response.statusText}`
            )
          }
          searchResult = await response.json()
        } else {
          // Use the provider factory to get the appropriate search provider
          const searchProvider = createSearchProvider(searchAPI)

          // Pass content_types only for Brave provider
          if (searchAPI === 'brave') {
            searchResult = await searchProvider.search(
              filledQuery,
              effectiveMaxResults,
              effectiveSearchDepthForAPI,
              include_domains,
              exclude_domains,
              {
                type: type as 'general' | 'optimized',
                content_types: content_types as Array<
                  'web' | 'video' | 'image' | 'news'
                >
              }
            )
          } else {
            searchResult = await searchProvider.search(
              filledQuery,
              effectiveMaxResults,
              effectiveSearchDepthForAPI,
              include_domains,
              exclude_domains
            )
          }

          if (personAnchor) {
            const constrainedResults = isPersonAchievementSearch(searchContext)
              ? await enrichIdentityAttributionResults(
                  searchResult.results,
                  personAnchor
                )
              : constrainIdentityAttributionResults(
                  searchResult.results,
                  personAnchor
                )
            searchResult = {
              ...searchResult,
              results: constrainedResults,
              number_of_results: constrainedResults.length
            }
          }

          if (shouldExpandIdentityCompanies && personAnchor) {
            const currentYear = new Date().getUTCFullYear()
            const discoveryQueries = [
              `"${personAnchor}" founder current company latest ${currentYear}`,
              `site:linkedin.com/posts "${personAnchor}" founder ${currentYear}`
            ]
            const discoveries = await Promise.all(
              discoveryQueries
                .filter(discoveryQuery => discoveryQuery !== filledQuery)
                .map(discoveryQuery =>
                  searchProvider.search(
                    discoveryQuery,
                    Math.min(effectiveMaxResults, 10),
                    effectiveSearchDepthForAPI,
                    include_domains,
                    exclude_domains
                  )
                )
            )
            const discoveryResults = constrainIdentityAttributionResults(
              discoveries.flatMap(discovery => discovery.results),
              personAnchor
            )
            const candidates = extractIdentityCompanyCandidates(
              [...discoveryResults, ...searchResult.results].map(
                result =>
                  `${result.title ?? ''} ${result.url ?? ''} ${result.content ?? ''}`
              )
            )

            if (candidates.length > 0) {
              const personSlug = personAnchor
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
              const expansions = await Promise.all(
                candidates.map(async candidate => {
                  const candidateSearches = await Promise.all(
                    [
                      'product',
                      'what it does',
                      'company brain',
                      'waitlist website'
                    ].map(intent =>
                      searchProvider.search(
                        `site:linkedin.com/posts/${personSlug} ${candidate} ${intent}`,
                        Math.min(effectiveMaxResults, 10),
                        effectiveSearchDepthForAPI,
                        include_domains,
                        exclude_domains
                      )
                    )
                  )
                  const candidateResults = interleaveResults(
                    candidateSearches.map(search => search.results)
                  ).filter(
                    (result, index, all) =>
                      all.findIndex(
                        candidate => candidate.url === result.url
                      ) === index
                  )
                  return {
                    ...candidateSearches[0],
                    query: `identity product verification: ${candidate}`,
                    results: candidateResults,
                    number_of_results: candidateResults.length
                  }
                })
              )
              const productEvidenceResolution = buildIdentityResolution({
                person: personAnchor,
                candidates: candidates.map((company, index) => ({
                  company,
                  results: expansions[index]?.results ?? []
                }))
              })
              const identityResolution =
                productEvidenceResolution ??
                buildIdentityResolution({
                  person: personAnchor,
                  candidates: candidates.map((company, index) => ({
                    company,
                    results: [
                      ...(expansions[index]?.results ?? []),
                      ...discoveryResults,
                      ...searchResult.results
                    ].filter(result =>
                      `${result.title} ${result.content}`
                        .toLowerCase()
                        .includes(company)
                    )
                  }))
                })
              if (identityResolution) {
                onIdentityResolution?.(identityResolution)
              }
              const orderedExpansions = identityResolution
                ? candidates
                    .map((company, index) => ({
                      company,
                      results: expansions[index]?.results ?? []
                    }))
                    .filter(
                      candidate =>
                        candidate.company ===
                        identityResolution.current_company_candidate
                    )
                    .sort((a, b) => {
                      const current =
                        identityResolution.current_company_candidate
                      if (a.company === current) return -1
                      if (b.company === current) return 1
                      return 0
                    })
                    .map(candidate => candidate.results)
                : expansions.map(expansion => expansion.results)
              const historicalCandidateUrls = identityResolution
                ? new Set(
                    candidates.flatMap((company, index) => {
                      if (
                        company === identityResolution.current_company_candidate
                      ) {
                        return []
                      }
                      return (expansions[index]?.results ?? [])
                        .filter(result => {
                          const text =
                            `${result.title} ${result.content}`.toLowerCase()
                          return (
                            text.includes(company) &&
                            !text.includes(
                              identityResolution.current_company_candidate
                            )
                          )
                        })
                        .map(result => result.url)
                    })
                  )
                : new Set<string>()
              const mergedResults = [
                ...interleaveResults(orderedExpansions),
                ...interleaveResults(
                  discoveries.map(discovery => discovery.results)
                ),
                ...searchResult.results
              ].filter(
                (result, index, all) =>
                  !historicalCandidateUrls.has(result.url) &&
                  all.findIndex(candidate => candidate.url === result.url) ===
                    index
              )

              searchResult = {
                ...searchResult,
                results: mergedResults.slice(0, effectiveMaxResults),
                number_of_results: Math.min(
                  mergedResults.length,
                  effectiveMaxResults
                ),
                ...(identityResolution && {
                  identity_resolution: identityResolution
                })
              }
            } else if (discoveryResults.length > 0) {
              const mergedResults = [
                ...interleaveResults(
                  discoveries.map(discovery => discovery.results)
                ),
                ...searchResult.results
              ].filter(
                (result, index, all) =>
                  all.findIndex(candidate => candidate.url === result.url) ===
                  index
              )
              searchResult = {
                ...searchResult,
                results: mergedResults.slice(0, effectiveMaxResults),
                number_of_results: Math.min(
                  mergedResults.length,
                  effectiveMaxResults
                )
              }
            }
          }
        }
      } catch (error) {
        console.error('Search API error:', error)
        // Re-throw the error to let AI SDK handle it properly
        throw error instanceof Error ? error : new Error('Unknown search error')
      }

      // No citationMap is attached: it fully duplicated `results`
      // (citationMap[N] === results[N-1]). The UI derives citations from
      // `results` by index instead (see extractCitationMaps), with a fallback
      // for older persisted messages that still carry citationMap.

      // Add toolCallId from context
      if (context?.toolCallId) {
        searchResult.toolCallId = context.toolCallId
      }

      console.log('completed search')

      logToolPayload('search', filledQuery, {
        results: searchResult.results,
        images: searchResult.images
      })

      // Yield final results with complete state
      yield {
        state: 'complete' as const,
        ...searchResult,
        query: filledQuery
      }
    },
    // Trim the model-facing tool result: citationMap fully duplicates
    // `results` (dropped defensively for older persisted output) and state is
    // a streaming marker. images MUST stay — getImageSpecPrompt instructs the
    // model to embed URLs verbatim from this array. toolCallId MUST stay: the
    // prompt cites as [number](#toolCallId), so the model reads the id from
    // here.
    toModelOutput: ({ output }) => {
      if (!output || typeof output !== 'object') {
        return { type: 'json', value: (output ?? null) as JSONValue }
      }
      const modelView: Record<string, unknown> = {
        ...(output as Record<string, unknown>)
      }
      delete modelView.citationMap
      delete modelView.state

      const toolCallId = modelView.toolCallId
      if (typeof toolCallId === 'string' && Array.isArray(modelView.results)) {
        modelView.results = modelView.results.map((result, index) =>
          result && typeof result === 'object'
            ? {
                ...(result as Record<string, unknown>),
                citation: `[${index + 1}](#${toolCallId})`
              }
            : result
        )
        modelView.citation_instruction =
          'Copy the citation field from each supporting result exactly after the sentence it supports.'
      }
      return { type: 'json', value: modelView as JSONValue }
    }
  })
}

function interleaveResults<T>(groups: T[][]): T[] {
  const interleaved: T[] = []
  const longest = Math.max(0, ...groups.map(group => group.length))
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const item = group[index]
      if (item !== undefined) interleaved.push(item)
    }
  }
  return interleaved
}

// Default export for backward compatibility, using a default model
export const searchTool = createSearchTool('openai:gpt-4o-mini')

// Export type for UI tool invocation
export type SearchUIToolInvocation = UIToolInvocation<typeof searchTool>

export async function search(
  query: string,
  maxResults: number = 10,
  searchDepth: 'basic' | 'advanced' = 'basic',
  includeDomains: string[] = [],
  excludeDomains: string[] = []
): Promise<SearchResults> {
  const result = await searchTool.execute?.(
    {
      query,
      type: 'general',
      content_types: ['web'],
      max_results: maxResults,
      search_depth: searchDepth,
      include_domains: includeDomains,
      exclude_domains: excludeDomains
    },
    {
      toolCallId: 'search',
      messages: []
    }
  )

  if (!result) {
    return { results: [], images: [], query, number_of_results: 0 }
  }

  // Handle AsyncIterable case
  if (Symbol.asyncIterator in result) {
    // Collect all results from the async iterable
    let searchResults: SearchResults | null = null
    for await (const chunk of result) {
      // Only assign when we get the complete result
      if ('state' in chunk && chunk.state === 'complete') {
        const { state, ...rest } = chunk
        searchResults = rest as SearchResults
      }
    }
    return (
      searchResults ?? { results: [], images: [], query, number_of_results: 0 }
    )
  }

  return result as SearchResults
}
