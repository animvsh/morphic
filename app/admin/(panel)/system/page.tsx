import { getSystemReport, getUsageDaily } from '@/lib/admin/data'

import {
  formatDate,
  MetricCard,
  PageHeader,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'

export default async function AdminSystemPage() {
  const [report, usage] = await Promise.all([
    getSystemReport(),
    getUsageDaily(30)
  ])
  const providerUsage = new Map<
    string,
    { queries: number; tokens: number; cost: number }
  >()
  for (const row of usage) {
    const key = String(row.model_id)
    const current = providerUsage.get(key) ?? { queries: 0, tokens: 0, cost: 0 }
    current.queries += Number(row.query_count ?? 0)
    current.tokens += Number(row.total_tokens ?? 0)
    current.cost += Number(row.estimated_cost_usd ?? 0)
    providerUsage.set(key, current)
  }
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="System readiness"
        description="Admin ledger health, incomplete requests, model rate provenance, provider usage, and recent safe errors."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Admin database"
          value="Ready"
          detail="Protected readiness query passed"
        />
        <MetricCard
          label="Active admins"
          value={String(report.activeAdminCount)}
        />
        <MetricCard
          label="Incomplete requests"
          value={String(report.incomplete.length)}
          detail="Started more than 10 minutes ago"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Provider usage · 30 days">
          <div className="divide-y divide-black/7">
            {[...providerUsage.entries()].map(([model, values]) => (
              <div
                key={model}
                className="grid grid-cols-[1fr_auto] gap-4 p-5 text-xs"
              >
                <div>
                  <p className="font-semibold">{model}</p>
                  <p className="mt-1 text-black/42">
                    {values.queries} queries · {values.tokens.toLocaleString()}{' '}
                    tokens
                  </p>
                </div>
                <p className="font-semibold">${values.cost.toFixed(5)}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Versioned model rates"
          description="Costs are estimates reproduced from effective-dated rates."
        >
          <div className="divide-y divide-black/7">
            {report.rates.map((rate: any) => (
              <div key={rate.id} className="p-5 text-xs">
                <p className="font-semibold">{rate.model_id}</p>
                <p className="mt-2 text-black/48">
                  Input ${rate.input_per_million_usd}/M · Output $
                  {rate.output_per_million_usd}/M
                </p>
                <p className="mt-1 text-[10px] text-black/35">
                  Effective {formatDate(rate.effective_from)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Recent errors" className="mt-5">
        <div className="divide-y divide-black/7">
          {report.failed.map(query => (
            <div
              key={query.id}
              className="grid gap-3 p-5 lg:grid-cols-[160px_1fr_180px]"
            >
              <div>
                <StatusPill status="failed" />
                <p className="mt-2 text-[10px] text-black/35">
                  {formatDate(query.startedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold">
                  {query.errorCode ?? 'stream_error'}
                </p>
                <p className="mt-1 text-xs text-black/45">
                  {query.errorMessage ?? 'No safe error detail recorded'}
                </p>
              </div>
              <p className="break-all text-[10px] text-black/35 lg:text-right">
                {query.id}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
