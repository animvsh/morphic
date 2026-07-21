import Link from 'next/link'

import { listAdminQueries } from '@/lib/admin/data'

import {
  buttonClass,
  EmptyState,
  formatDate,
  formatNumber,
  PageHeader,
  Pagination,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'
import { PromptReveal } from '@/components/admin/prompt-reveal'

export default async function AdminQueriesPage({
  searchParams
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    mode?: string
    page?: string
  }>
}) {
  const params = await searchParams
  const result = await listAdminQueries({
    search: params.search,
    status: params.status,
    mode: params.mode,
    page: Math.max(1, Number(params.page ?? 1) || 1),
    pageSize: 20
  })
  return (
    <>
      <PageHeader
        eyebrow="Usage ledger"
        title="Queries"
        description="Every submitted and regenerated request, including model usage, tools, timing, errors, and conversation linkage. Prompt reveals are audited."
      />
      <Panel title={`${result.total} request events`}>
        <form className="grid gap-2 border-b border-black/7 p-4 lg:grid-cols-[1fr_150px_150px_auto]">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Prompt, email, name, or event ID"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          />
          <select
            name="status"
            defaultValue={params.status ?? 'all'}
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="all">All outcomes</option>
            <option value="started">Streaming</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="aborted">Aborted</option>
          </select>
          <select
            name="mode"
            defaultValue={params.mode ?? 'all'}
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="all">All modes</option>
            <option value="quick">Quick</option>
            <option value="adaptive">Adaptive</option>
          </select>
          <button className={buttonClass}>Filter</button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState>No query events matched this filter.</EmptyState>
        ) : (
          <div className="divide-y divide-black/7">
            {result.items.map(query => (
              <article key={query.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={query.status} />
                      <span className="rounded-full bg-black/5 px-2 py-1 text-[10px] font-semibold">
                        {query.searchMode}
                      </span>
                      <span className="text-[10px] text-black/38">
                        {query.id}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold">
                      {query.userId ? (
                        <Link
                          href={`/admin/users/${query.userId}`}
                          className="hover:underline"
                        >
                          {query.userName || query.email || query.userId}
                        </Link>
                      ) : (
                        'Guest request'
                      )}
                    </p>
                    <p className="mt-1 text-xs text-black/42">
                      {formatDate(query.startedAt)} · {query.providerId}/
                      {query.modelId}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-5 text-right text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-black/35">
                        Tokens
                      </p>
                      <p className="mt-1 font-semibold">
                        {formatNumber(query.totalTokens ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-black/35">
                        Duration
                      </p>
                      <p className="mt-1 font-semibold">
                        {query.durationMs == null
                          ? '—'
                          : `${(query.durationMs / 1000).toFixed(1)}s`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-black/35">
                        Est. cost
                      </p>
                      <p className="mt-1 font-semibold">
                        ${(query.estimatedCostUsd ?? 0).toFixed(5)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_.7fr]">
                  <PromptReveal eventId={query.id} />
                  <div className="rounded-xl bg-black/[0.025] p-3 text-xs leading-5 text-black/55">
                    <p className="line-clamp-3">
                      {query.responsePreview || 'No persisted answer preview.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-black/38">
                      <span>{query.toolCalls} tools</span>
                      <span>{query.searchCalls} searches</span>
                      <span>{query.fetchCalls} fetches</span>
                      <span>first token {query.firstTokenMs ?? '—'} ms</span>
                      {query.chatId && (
                        <Link
                          className="font-semibold text-black/60 hover:underline"
                          href={`/admin/conversations/${query.chatId}`}
                        >
                          Open conversation
                        </Link>
                      )}
                      {query.traceId && (
                        <span title={query.traceId}>Trace linked</span>
                      )}
                    </div>
                    {query.errorCode && (
                      <p className="mt-3 rounded-lg bg-red-50 p-2 text-red-700">
                        {query.errorCode}: {query.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <Pagination
          basePath="/admin/queries"
          page={result.page}
          pageCount={result.pageCount}
          params={{
            search: params.search,
            status: params.status,
            mode: params.mode
          }}
        />
      </Panel>
    </>
  )
}
