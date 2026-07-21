import Link from 'next/link'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/38">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/52">
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white/72 p-5 shadow-[0_1px_0_rgba(255,255,255,.7)_inset]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/42">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
      {detail && <p className="mt-1 text-xs text-black/42">{detail}</p>}
    </div>
  )
}

export function Panel({
  title,
  description,
  children,
  className = ''
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-black/8 bg-white/72 ${className}`}
    >
      <div className="border-b border-black/7 px-5 py-4">
        <h2 className="font-semibold tracking-[-0.02em]">{title}</h2>
        {description && (
          <p className="mt-1 text-xs leading-5 text-black/45">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'active' || status === 'succeeded' || status === 'resolved'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'suspended' || status === 'failed'
        ? 'bg-red-100 text-red-800'
        : status === 'started' || status === 'in_progress'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-black/6 text-black/60'
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-12 text-center text-sm text-black/42">
      {children}
    </div>
  )
}

export const buttonClass =
  'inline-flex h-9 items-center justify-center rounded-xl border border-black/10 bg-white px-3.5 text-xs font-semibold shadow-sm transition hover:bg-black hover:text-white'

export function Pagination({
  basePath,
  page,
  pageCount,
  params
}: {
  basePath: string
  page: number
  pageCount: number
  params?: Record<string, string | undefined>
}) {
  const href = (nextPage: number) => {
    const search = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value) search.set(key, value)
    })
    search.set('page', String(nextPage))
    return `${basePath}?${search}`
  }
  return (
    <div className="flex items-center justify-between border-t border-black/7 px-5 py-4 text-xs text-black/48">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className={buttonClass} href={href(page - 1)}>
            Previous
          </Link>
        )}
        {page < pageCount && (
          <Link className={buttonClass} href={href(page + 1)}>
            Next
          </Link>
        )}
      </div>
    </div>
  )
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
}

export function formatDate(value?: string) {
  if (!value) return 'never'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
