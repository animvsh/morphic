import Link from 'next/link'

import { listAdminUsers } from '@/lib/admin/data'

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

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1) || 1)
  const result = await listAdminUsers({
    search: params.search,
    status: params.status,
    page
  })
  return (
    <>
      <PageHeader
        eyebrow="Accounts"
        title="Users"
        description="Search every account, inspect durable usage, manage access, and export a safe projection."
        actions={
          <a className={buttonClass} href="/api/admin/users/export">
            Export CSV
          </a>
        }
      />
      <Panel title={`${result.total} accounts`}>
        <form className="grid gap-2 border-b border-black/7 p-4 sm:grid-cols-[1fr_170px_auto]">
          <input
            name="search"
            defaultValue={params.search}
            placeholder="Search email or name"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
          <select
            name="status"
            defaultValue={params.status ?? 'all'}
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>
          <button className={buttonClass}>Filter</button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState>No users matched this filter.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-black/[0.025] text-[10px] uppercase tracking-[0.1em] text-black/42">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last active</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Queries
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Tokens</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Storage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {result.items.map(user => (
                  <tr key={user.id} className="hover:bg-black/[0.02]">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-semibold hover:underline"
                      >
                        {user.name}
                      </Link>
                      <p className="mt-1 text-[11px] text-black/42">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={user.accountStatus} />
                    </td>
                    <td className="px-4 py-4 text-black/52">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium">
                      {formatNumber(user.queryCount)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatNumber(user.totalTokens)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      ${user.estimatedCostUsd.toFixed(4)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {(user.storageBytes / 1024 / 1024).toFixed(1)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/admin/users"
          page={result.page}
          pageCount={result.pageCount}
          params={{ search: params.search, status: params.status }}
        />
      </Panel>
    </>
  )
}
