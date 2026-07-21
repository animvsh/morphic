import { IconSearch as Search } from '@tabler/icons-react'

import { SearchMode } from '@/lib/types/search'

import { IconLogoOutline } from '@/components/ui/icons'

export interface SearchModeConfig {
  value: SearchMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

// Centralized search mode configuration
export const SEARCH_MODE_CONFIGS: SearchModeConfig[] = [
  {
    value: 'quick',
    label: 'deep search',
    description: 'search the web for a grounded answer',
    icon: Search,
    color: 'text-amber-500'
  },
  {
    value: 'adaptive',
    label: 'reason',
    description: 'let brok decide when to search and think deeper',
    icon: IconLogoOutline,
    color: 'text-violet-500'
  }
]

// Helper function to get a specific mode config
export function getSearchModeConfig(
  mode: SearchMode
): SearchModeConfig | undefined {
  return SEARCH_MODE_CONFIGS.find(config => config.value === mode)
}
