import Link from 'next/link'

import {
  getDashboardMetrics,
  getUsageDaily,
  listAdminQueries
} from '@/lib/admin/data'

import {
  buttonClass,
  formatDate,
  formatNumber,
  MetricCard,
  PageHeader,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const params = await searchParams
  const days = Math.min(365, Math.max(1, Number(params.days ?? 30) || 30))
  const [metrics, usage, recent] = await Promise.all([
    getDashboardMetrics(days),
    getUsageDaily(days),
    listAdminQueries({ pageSize: 10 })
  ])
  const successRate = metrics.queries
    ? (metrics.successfulQueries / metrics.queries) * 100
    : 0
  const maxDaily = Math.max(
    1,
    ...usage.map(row => Number(row.query_count ?? 0))
  )

  return (
    <>
      <PageHeader
        eyebrow="Live operations"
        title="Brok at a glance"
        description="Durable product usage, account health, feedback, and estimated model spend from the authoritative InsForge ledger."
        actions={
          <form className="flex gap-2">
            <select
              name="days"
              defaultValue={String(days)}
              className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <button className={buttonClass}>Apply</button>
          </form>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total users"
          value={formatNumber(metrics.totalUsers)}
          detail={`${formatNumber(metrics.newUsers)} new in range`}
        />
        <MetricCard
          label="Active users"
          value={formatNumber(metrics.activeUsers)}
          detail={`${formatNumber(metrics.queries)} submitted queries`}
        />
        <MetricCard
          label="Success rate"
          value={`${successRate.toFixed(1)}%`}
          detail={`${metrics.failedQueries} failed requests`}
        />
        <MetricCard
          label="Estimated cost"
          value={`$${metrics.estimatedCostUsd.toFixed(4)}`}
          detail={`${formatNumber(metrics.totalTokens)} model tokens`}
        />
        <MetricCard
          label="First token"
          value={`${Math.round(metrics.averageFirstTokenMs)} ms`}
          detail="Average observed latency"
        />
        <MetricCard
          label="Request duration"
          value={`${(metrics.averageDurationMs / 1000).toFixed(1)} s`}
          detail="Average end-to-end"
        />
        <MetricCard
          label="Feedback"
          value={formatNumber(metrics.feedbackCount)}
          detail="Submitted in range"
        />
        <MetricCard
          label="Stored files"
          value={`${(metrics.storageBytes / 1024 / 1024).toFixed(1)} MB`}
          detail="Current library storage"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel
          title="Request volume"
          description="Daily requests split by model, mode, and outcome."
        >
          <div className="space-y-3 p-5">
            {usage.length === 0 ? (
              <p className="py-10 text-center text-sm text-black/40">
                Usage will appear after the first instrumented request.
              </p>
            ) : (
              usage.slice(-30).map((row, index) => {
                const count = Number(row.query_count ?? 0)
                return (
                  <div
                    key={`${row.usage_day}-${row.model_id}-${row.status}-${index}`}
                    className="grid grid-cols-[90px_1fr_42px] items-center gap-3 text-xs"
                  >
                    <span className="text-black/48">
                      {new Date(row.usage_day).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full bg-[#657c58]"
                        style={{
                          width: `${Math.max(2, (count / maxDaily) * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-right font-semibold">{count}</span>
                  </div>
                )
              })
            )}
          </div>
        </Panel>
        <Panel
          title="Recent queries"
          description="Latest activity across all accounts."
        >
          <div className="divide-y divide-black/6">
            {recent.items.map(query => (
              <Link
                key={query.id}
                href={`/admin/queries?search=${encodeURIComponent(query.id)}`}
                className="block px-5 py-4 transition hover:bg-black/[0.025]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {query.userName || query.email || 'Guest'}
                  </p>
                  <StatusPill status={query.status} />
                </div>
                <p className="mt-1 truncate text-xs text-black/43">
                  {query.queryText || 'Regenerated query'}
                </p>
                <p className="mt-2 text-[10px] text-black/35">
                  {formatDate(query.startedAt)} · {query.searchMode}
                </p>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}
