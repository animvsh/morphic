import { stepCountIs, tool, ToolLoopAgent } from 'ai'

import type { ResearcherTools } from '@/lib/types/agent'
import { type Model } from '@/lib/types/models'

import { fetchTool } from '../tools/fetch'
import {
  extractAchievementPersonAnchor,
  type IdentityResolution
} from '../tools/identity-resolution'
import { createQuestionTool } from '../tools/question'
import { createSearchTool } from '../tools/search'
import { extractPersonAnchor } from '../tools/search-query-grounding'
import { createTodoTools } from '../tools/todo'
import { SearchMode } from '../types/search'
import { getModel } from '../utils/registry'
import { isTracingEnabled } from '../utils/telemetry'

import {
  getAdaptiveModePrompt,
  QUICK_MODE_PROMPT
} from './prompts/search-mode-prompts'

// Enhanced wrapper function with better type safety and streaming support
function wrapSearchToolForQuickMode<
  T extends ReturnType<typeof createSearchTool>
>(originalTool: T): T {
  return tool({
    description: originalTool.description,
    inputSchema: originalTool.inputSchema,
    // Preserve the original tool's model-output trimming (strips the duplicated
    // citationMap / UI-only images) so quick mode gets the same payload savings.
    toModelOutput: originalTool.toModelOutput,
    async *execute(params, context) {
      const executeFunc = originalTool.execute
      if (!executeFunc) {
        throw new Error('Search tool execute function is not defined')
      }

      // Force optimized type for quick mode
      const modifiedParams = {
        ...params,
        type: 'optimized' as const
      }

      // Execute the original tool and pass through all yielded values
      const result = executeFunc(modifiedParams, context)

      // Handle AsyncIterable (streaming) case
      if (
        result &&
        typeof result === 'object' &&
        Symbol.asyncIterator in result
      ) {
        for await (const chunk of result) {
          yield chunk
        }
      } else {
        // Fallback for non-streaming (shouldn't happen with new implementation)
        const finalResult = await result
        yield finalResult || {
          state: 'complete' as const,
          results: [],
          images: [],
          query: params.query,
          number_of_results: 0
        }
      }
    }
  }) as T
}

// Enhanced researcher function with improved type safety using ToolLoopAgent
// Note: abortSignal should be passed to agent.stream() or agent.generate() calls, not to the agent constructor
export function createResearcher({
  model,
  modelConfig,
  searchMode = 'adaptive',
  searchContext
}: {
  model: string
  modelConfig?: Model
  searchMode?: SearchMode
  searchContext?: string
}) {
  try {
    const currentDate = new Date().toLocaleString()
    let latestIdentityResolution: IdentityResolution | undefined

    // Create model-specific tools with proper typing
    const originalSearchTool = createSearchTool(
      model,
      searchContext,
      resolution => {
        latestIdentityResolution = resolution
      }
    )
    const askQuestionTool = createQuestionTool(model)
    const todoTools = createTodoTools()
    const personAnchor =
      extractPersonAnchor(searchContext) ??
      extractAchievementPersonAnchor(searchContext)
    const needsIdentityFinalCheck =
      !!personAnchor &&
      /\b(?:current\s+company|founder|co-?founder|what\s+company|company\s+does|currently\s+runs?)\b/i.test(
        searchContext ?? ''
      )

    let systemPrompt: string
    let activeToolsList: (keyof ResearcherTools)[] = []
    let maxSteps: number
    let searchTool = originalSearchTool

    // Configure based on search mode
    switch (searchMode) {
      case 'quick':
        console.log(
          '[Researcher] Quick mode: maxSteps=20, tools=[search, fetch]'
        )
        systemPrompt = QUICK_MODE_PROMPT
        activeToolsList = ['search', 'fetch']
        maxSteps = 20
        searchTool = wrapSearchToolForQuickMode(originalSearchTool)
        break

      case 'adaptive':
      default:
        systemPrompt = getAdaptiveModePrompt()
        activeToolsList = ['search', 'fetch', 'todoWrite']
        console.log(
          `[Researcher] Adaptive mode: maxSteps=50, tools=[${activeToolsList.join(', ')}]`
        )
        maxSteps = 50
        searchTool = originalSearchTool
        break
    }

    // Build tools object with proper typing
    const tools: ResearcherTools = {
      search: searchTool,
      fetch: fetchTool,
      askQuestion: askQuestionTool,
      ...todoTools
    } as ResearcherTools

    // Create ToolLoopAgent with all configuration
    const instructions = `${systemPrompt}\nCurrent date and time: ${currentDate}`
    const agent = new ToolLoopAgent({
      model: getModel(model),
      instructions,
      tools,
      activeTools: activeToolsList,
      stopWhen: stepCountIs(maxSteps),
      prepareStep: () =>
        !personAnchor
          ? undefined
          : {
              system: `${instructions}\n\n${
                needsIdentityFinalCheck && latestIdentityResolution
                  ? `IDENTITY RESOLUTION (DETERMINISTIC DATED-SOURCE COMPARISON; MUST FOLLOW): ${JSON.stringify(latestIdentityResolution)}`
                  : needsIdentityFinalCheck
                    ? 'IDENTITY RESOLUTION: No deterministic dated-source comparison is available yet; do not guess.'
                    : `PERSON ATTRIBUTION TARGET: ${personAnchor}. Do not force a company summary unless the user asked for it.`
              }\n\nPERSON ATTRIBUTION FINAL CHECK: A personal achievement, award, hackathon placement, project, or teammate is allowed only when one cited result contains the exact person's name in the same local evidence block as that exact claim. On a page listing multiple teams or winners, use only the winner section containing ${personAnchor}; never join an adjacent track, project, or teammate list to him. If the source names a different team, omit that claim. Do not add incidental roles or affiliations the user did not ask for.\n\n${
                needsIdentityFinalCheck
                  ? 'COMPANY IDENTITY FINAL CHECK: Name the evidence-resolved current company, explain in one concrete sentence what its product connects or does and the user outcome, correct any stale company premise briefly, and omit all unrequested historical product copy.'
                  : 'SCOPE CHECK: Answer only the requested identity facts. Do not append a general company, school, fellowship, or biography section.'
              } Every cited claim must use Morphic's clickable syntax [result number](#exactToolCallId); never emit bare [1] markers. If the evidence cannot support a claim, say exactly what remains unverified instead of substituting a nearby result.`
            },
      ...(modelConfig?.providerOptions && {
        providerOptions: modelConfig.providerOptions
      }),
      // Spans join the parent Langfuse trace via OTel context propagation
      experimental_telemetry: {
        isEnabled: isTracingEnabled(),
        functionId: 'research-agent',
        metadata: {
          modelId: model,
          agentType: 'researcher',
          searchMode
        }
      }
    })

    return agent
  } catch (error) {
    console.error('Error in createResearcher:', error)
    throw error
  }
}

// Helper function to access agent tools
export function getResearcherTools(
  agent: ToolLoopAgent<never, ResearcherTools, never>
): ResearcherTools {
  return agent.tools
}

// Export the legacy function name for backward compatibility
export const researcher = createResearcher
