import Link from 'next/link'

import type { AdminActor } from '@/lib/admin/types'

const navigation = [
  { href: '/admin', label: 'Overview', mark: '01' },
  { href: '/admin/users', label: 'Users', mark: '02' },
  { href: '/admin/queries', label: 'Queries', mark: '03' },
  { href: '/admin/feedback', label: 'Feedback', mark: '04' },
  { href: '/admin/files', label: 'Files', mark: '05' },
  { href: '/admin/system', label: 'System', mark: '06' },
  { href: '/admin/administrators', label: 'Administrators', mark: '07' },
  { href: '/admin/audit', label: 'Audit log', mark: '08' }
]

export function AdminShell({
  actor,
  children
}: {
  actor: AdminActor
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f3f4ef] text-[#181916]">
      <header className="sticky top-0 z-40 border-b border-black/8 bg-[#f3f4ef]/90 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <span className="size-7 rounded-lg bg-[#191b17]" /> brok admin
          </Link>
          <span className="rounded-full bg-black/6 px-3 py-1 text-xs font-medium">
            {actor.membership.role.replace('_', ' ')}
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
          {navigation.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full border border-black/8 bg-white/60 px-3 py-1.5 text-xs font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/8 bg-[#e9ebe4] p-5 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-10 flex items-center gap-3 px-2">
          <span className="size-9 rounded-[11px] bg-[#191b17] shadow-sm" />
          <span>
            <span className="block text-[15px] font-semibold tracking-[-0.02em]">
              brok admin
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-black/40">
              operations
            </span>
          </span>
        </Link>
        <nav className="space-y-1">
          {navigation.map(item => {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-black/62 transition hover:bg-white/70 hover:text-black"
              >
                <span className="w-5 font-mono text-[9px] text-black/32">
                  {item.mark}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-black/8 bg-white/55 p-3.5">
          <p className="truncate text-sm font-semibold">{actor.name}</p>
          <p className="truncate text-xs text-black/45">{actor.email}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-[#dfe8d8] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#35552b]">
              {actor.membership.role.replace('_', ' ')}
            </span>
            <Link href="/" className="text-xs text-black/50 hover:text-black">
              Exit
            </Link>
          </div>
        </div>
      </aside>
      <main className="mx-auto max-w-[1600px] px-4 py-7 lg:ml-64 lg:px-8 lg:py-9">
        {children}
      </main>
    </div>
  )
}
