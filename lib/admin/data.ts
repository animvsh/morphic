import { getInsForgeAdminClient } from '@/lib/insforge/admin'

import 'server-only'

import type {
  AdminDashboardMetrics,
  AdminQueryEvent,
  AdminUserSummary,
  PaginatedResult
} from './types'

type QueryResult<T> = { data: T | null; error: any; count?: number | null }

function ensure<T>(result: QueryResult<T>, label: string): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message ?? result.error}`)
  }
  return result.data as T
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined
  return number(value)
}

function mapUser(row: any): AdminUserSummary {
  return {
    id: String(row.id),
    email: String(row.email ?? ''),
    emailVerified: Boolean(row.email_verified),
    name: String(row.name ?? row.email ?? 'Unknown user'),
    avatarUrl: row.avatar_url ?? undefined,
    authProvider: String(row.auth_provider ?? 'email'),
    accountStatus: row.account_status ?? 'active',
    suspensionReason: row.suspension_reason ?? undefined,
    suspendedUntil: row.suspended_until ?? undefined,
    quickDailyLimit: optionalNumber(row.quick_daily_limit),
    adaptiveDailyLimit: optionalNumber(row.adaptive_daily_limit),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastActiveAt: row.last_active_at ?? undefined,
    chatCount: number(row.chat_count),
    queryCount: number(row.query_count),
    totalTokens: number(row.total_tokens),
    estimatedCostUsd: number(row.estimated_cost_usd),
    noteCount: number(row.note_count),
    fileCount: number(row.file_count),
    storageBytes: number(row.storage_bytes),
    feedbackCount: number(row.feedback_count)
  }
}

function mapQuery(row: any, includeSensitive = false): AdminQueryEvent {
  return {
    id: String(row.id),
    userId: row.user_id ?? undefined,
    guestKey: row.guest_key ?? undefined,
    email: row.email ?? undefined,
    userName: row.user_name ?? undefined,
    chatId: row.chat_id ?? undefined,
    requestMessageId: row.request_message_id ?? undefined,
    responseMessageId: row.response_message_id ?? undefined,
    queryText: includeSensitive ? String(row.query_text ?? '') : '',
    responsePreview: String(row.response_preview ?? ''),
    trigger: row.trigger,
    searchMode: row.search_mode,
    providerId: String(row.provider_id),
    modelId: String(row.model_id),
    status: row.status,
    inputTokens: optionalNumber(row.input_tokens),
    outputTokens: optionalNumber(row.output_tokens),
    reasoningTokens: optionalNumber(row.reasoning_tokens),
    cacheReadTokens: optionalNumber(row.cache_read_tokens),
    cacheWriteTokens: optionalNumber(row.cache_write_tokens),
    totalTokens: optionalNumber(row.total_tokens),
    searchCalls: number(row.search_calls),
    fetchCalls: number(row.fetch_calls),
    toolCalls: number(row.tool_calls),
    startedAt: String(row.started_at),
    firstTokenMs: optionalNumber(row.first_token_ms),
    durationMs: optionalNumber(row.duration_ms),
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    traceId: row.trace_id ?? undefined,
    estimatedCostUsd: optionalNumber(row.estimated_cost_usd)
  }
}

function safeSearch(value: string): string {
  return value
    .trim()
    .replace(/[(),.%]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
}

function decodeCursor(value?: string) {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed.at !== 'string' || typeof parsed.id !== 'string')
      return null
    return { at: parsed.at, id: parsed.id }
  } catch {
    return null
  }
}

function encodeCursor(at: string, id: string) {
  return Buffer.from(JSON.stringify({ at, id }), 'utf8').toString('base64url')
}

export async function getDashboardMetrics(days = 30) {
  const client = getInsForgeAdminClient()
  const rangeEnd = new Date()
  const rangeStart = new Date(rangeEnd.getTime() - days * 86400000)
  const result = (await client.database.rpc('brok_admin_dashboard', {
    range_start: rangeStart.toISOString(),
    range_end: rangeEnd.toISOString()
  })) as QueryResult<Record<string, unknown>>
  const row = ensure(result, 'Load dashboard') ?? {}
  const metrics: AdminDashboardMetrics = {
    totalUsers: number(row.totalUsers),
    newUsers: number(row.newUsers),
    activeUsers: number(row.activeUsers),
    queries: number(row.queries),
    successfulQueries: number(row.successfulQueries),
    failedQueries: number(row.failedQueries),
    totalTokens: number(row.totalTokens),
    estimatedCostUsd: number(row.estimatedCostUsd),
    averageDurationMs: number(row.averageDurationMs),
    averageFirstTokenMs: number(row.averageFirstTokenMs),
    feedbackCount: number(row.feedbackCount),
    storageBytes: number(row.storageBytes)
  }
  return metrics
}

export async function getUsageDaily(days = 30) {
  const client = getInsForgeAdminClient()
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const result = (await client.database
    .from('brok_admin_usage_daily')
    .select('*')
    .gte('usage_day', since)
    .order('usage_day', { ascending: true })) as QueryResult<any[]>
  return ensure(result, 'Load usage series') ?? []
}

export async function listAdminUsers(
  options: {
    search?: string
    status?: string
    page?: number
    pageSize?: number
    cursor?: string
  } = {}
): Promise<PaginatedResult<AdminUserSummary>> {
  const client = getInsForgeAdminClient()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 25))
  const offset = (page - 1) * pageSize
  let request = client.database
    .from('brok_admin_user_directory')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  const search = safeSearch(options.search ?? '')
  if (search)
    request = request.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
  if (options.status && options.status !== 'all') {
    request = request.eq('account_status', options.status)
  }

  const cursor = decodeCursor(options.cursor)
  if (cursor) {
    request = request.or(
      `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`
    )
  }

  const result = (await (cursor
    ? request.limit(pageSize + 1)
    : request.range(offset, offset + pageSize))) as QueryResult<any[]>
  const fetchedRows = ensure(result, 'Load users') ?? []
  const hasMore = fetchedRows.length > pageSize
  const rows = fetchedRows.slice(0, pageSize)
  const total = result.count ?? rows.length
  return {
    items: rows.map(mapUser),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    nextCursor:
      hasMore && rows.length
        ? encodeCursor(String(rows.at(-1).created_at), String(rows.at(-1).id))
        : undefined
  }
}

export async function getAdminUser(
  userId: string,
  options: { includeSensitive?: boolean } = {}
) {
  const client = getInsForgeAdminClient()
  const userResult = (await client.database
    .from('brok_admin_user_directory')
    .select('*')
    .eq('id', userId)
    .maybeSingle()) as QueryResult<any>
  const userRow = ensure(userResult, 'Load user')
  if (!userRow) return null

  const [queries, chats, notes, files, feedback, audit, membership] =
    await Promise.all([
      client.database
        .from('brok_admin_query_directory')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(100),
      client.database
        .from('brok_chats')
        .select('id, title, visibility, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100),
      client.database
        .from('brok_notes')
        .select(
          options.includeSensitive
            ? 'id, title, content, chat_id, source_message_id, created_at, updated_at'
            : 'id, title, chat_id, created_at, updated_at'
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100),
      client.database
        .from('brok_library_files')
        .select(
          'id, filename, media_type, size, chat_id, created_at, updated_at'
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(100),
      client.database
        .from('brok_feedback')
        .select(
          'id, sentiment, message, page_url, status, resolution_note, created_at, updated_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      client.database
        .from('brok_admin_audit_log')
        .select('*')
        .eq('target_type', 'user')
        .eq('target_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      client.database
        .from('brok_admin_memberships')
        .select('user_id, role, status, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
    ])

  let conversationMessages: any[] = []
  let messageParts: any[] = []
  if (options.includeSensitive) {
    const chatIds = (chats.data ?? []).map((chat: any) => chat.id)
    if (chatIds.length) {
      const messagesResult = await client.database
        .from('brok_messages')
        .select('*')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: true })
      if (messagesResult.error) throw messagesResult.error
      conversationMessages = messagesResult.data ?? []
      const messageIds = conversationMessages.map(message => message.id)
      if (messageIds.length) {
        const partsResult = await client.database
          .from('brok_message_parts')
          .select('*')
          .in('message_id', messageIds)
          .order('part_order', { ascending: true })
        if (partsResult.error) throw partsResult.error
        messageParts = partsResult.data ?? []
      }
    }
  }

  return {
    user: mapUser(userRow),
    queries: (queries.data ?? []).map(row =>
      mapQuery(row, options.includeSensitive)
    ),
    chats: chats.data ?? [],
    notes: notes.data ?? [],
    files: files.data ?? [],
    feedback: feedback.data ?? [],
    audit: audit.data ?? [],
    membership: membership.data ?? null,
    ...(options.includeSensitive && { conversationMessages, messageParts })
  }
}

export async function listAdminQueries(
  options: {
    search?: string
    status?: string
    mode?: string
    page?: number
    pageSize?: number
    cursor?: string
  } = {}
): Promise<PaginatedResult<AdminQueryEvent>> {
  const client = getInsForgeAdminClient()
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 25))
  const offset = (page - 1) * pageSize
  let request = client.database
    .from('brok_admin_query_directory')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })

  const search = safeSearch(options.search ?? '')
  if (search) {
    const idFilter =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        search
      )
        ? `,id.eq.${search}`
        : ''
    request = request.or(
      `query_text.ilike.%${search}%,email.ilike.%${search}%,user_name.ilike.%${search}%${idFilter}`
    )
  }
  if (options.status && options.status !== 'all')
    request = request.eq('status', options.status)
  if (options.mode && options.mode !== 'all')
    request = request.eq('search_mode', options.mode)

  const cursor = decodeCursor(options.cursor)
  if (cursor) {
    request = request.or(
      `started_at.lt.${cursor.at},and(started_at.eq.${cursor.at},id.lt.${cursor.id})`
    )
  }

  const result = (await (cursor
    ? request.limit(pageSize + 1)
    : request.range(offset, offset + pageSize))) as QueryResult<any[]>
  const fetchedRows = ensure(result, 'Load queries') ?? []
  const hasMore = fetchedRows.length > pageSize
  const rows = fetchedRows.slice(0, pageSize)
  const total = result.count ?? rows.length
  return {
    items: rows.map(row => mapQuery(row)),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    nextCursor:
      hasMore && rows.length
        ? encodeCursor(String(rows.at(-1).started_at), String(rows.at(-1).id))
        : undefined
  }
}

export async function getAdminConversation(chatId: string) {
  const client = getInsForgeAdminClient()
  const chat = await client.database
    .from('brok_chats')
    .select('*')
    .eq('id', chatId)
    .maybeSingle()
  if (chat.error || !chat.data) return null
  const messages = await client.database
    .from('brok_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  return {
    chat: chat.data,
    messages: messages.data ?? []
  }
}

export async function listFeedback() {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250)
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function listWaitlist() {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_waitlist')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(250)
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function listAuditLog() {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function listAdminMemberships() {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_admin_memberships')
    .select('*')
    .order('created_at', { ascending: true })
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function listAdminFiles() {
  const client = getInsForgeAdminClient()
  const result = await client.database
    .from('brok_library_files')
    .select(
      'id, user_id, filename, media_type, size, chat_id, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .limit(500)
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function getSystemReport() {
  const client = getInsForgeAdminClient()
  const [failed, started, rates, memberships] = await Promise.all([
    client.database
      .from('brok_admin_query_directory')
      .select('*')
      .eq('status', 'failed')
      .order('started_at', { ascending: false })
      .limit(50),
    client.database
      .from('brok_request_events')
      .select('id, started_at')
      .eq('status', 'started')
      .lt('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(100),
    client.database
      .from('brok_model_rates')
      .select('*')
      .order('effective_from', { ascending: false }),
    client.database
      .from('brok_admin_memberships')
      .select('user_id', { count: 'exact' })
      .eq('status', 'active')
  ])
  for (const result of [failed, started, rates, memberships]) {
    if (result.error) throw new Error(result.error.message)
  }
  return {
    failed: (failed.data ?? []).map(row => mapQuery(row)),
    incomplete: started.data ?? [],
    rates: rates.data ?? [],
    activeAdminCount: memberships.count ?? memberships.data?.length ?? 0
  }
}
