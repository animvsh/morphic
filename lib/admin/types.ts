export type AdminRole = 'owner' | 'admin' | 'support' | 'read_only'
export type AdminPermission =
  | 'view'
  | 'support'
  | 'manage_users'
  | 'manage_admins'
  | 'delete_users'
  | 'export'

export type AccountStatus = 'active' | 'suspended' | 'deleted'

export interface AdminMembership {
  userId: string
  role: AdminRole
  status: 'active' | 'disabled'
}

export interface AdminActor {
  id: string
  email?: string
  name: string
  membership: AdminMembership
}

export interface AdminDashboardMetrics {
  totalUsers: number
  newUsers: number
  activeUsers: number
  queries: number
  successfulQueries: number
  failedQueries: number
  totalTokens: number
  estimatedCostUsd: number
  averageDurationMs: number
  averageFirstTokenMs: number
  feedbackCount: number
  storageBytes: number
}

export interface AdminUserSummary {
  id: string
  email: string
  emailVerified: boolean
  name: string
  avatarUrl?: string
  authProvider: string
  accountStatus: AccountStatus
  suspensionReason?: string
  suspendedUntil?: string
  quickDailyLimit?: number
  adaptiveDailyLimit?: number
  createdAt: string
  updatedAt: string
  lastActiveAt?: string
  chatCount: number
  queryCount: number
  totalTokens: number
  estimatedCostUsd: number
  noteCount: number
  fileCount: number
  storageBytes: number
  feedbackCount: number
}

export interface AdminQueryEvent {
  id: string
  userId?: string
  guestKey?: string
  email?: string
  userName?: string
  chatId?: string
  requestMessageId?: string
  responseMessageId?: string
  queryText: string
  responsePreview: string
  trigger: 'submit-message' | 'regenerate-message'
  searchMode: 'quick' | 'adaptive'
  providerId: string
  modelId: string
  status: 'started' | 'succeeded' | 'failed' | 'aborted'
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalTokens?: number
  searchCalls: number
  fetchCalls: number
  toolCalls: number
  startedAt: string
  firstTokenMs?: number
  durationMs?: number
  errorCode?: string
  errorMessage?: string
  traceId?: string
  estimatedCostUsd?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  nextCursor?: string
}
