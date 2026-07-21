import { notFound } from 'next/navigation'

import {
  deleteUserAsAdmin,
  setAccountStatus,
  setQuotaOverrides
} from '@/lib/admin/actions'
import { getAdminUser } from '@/lib/admin/data'

import {
  buttonClass,
  formatDate,
  formatNumber,
  MetricCard,
  PageHeader,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'
import { PromptReveal } from '@/components/admin/prompt-reveal'

export default async function AdminUserDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getAdminUser(id)
  if (!detail) notFound()
  const { user } = detail
  return (
    <>
      <PageHeader
        eyebrow="User detail"
        title={user.name}
        description={`${user.email} · joined ${formatDate(user.createdAt)} · ${user.authProvider} authentication`}
        actions={
          <a className={buttonClass} href={`/api/admin/users/${id}/export`}>
            Export user data
          </a>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Account"
          value={user.accountStatus}
          detail={user.suspensionReason}
        />
        <MetricCard label="Queries" value={formatNumber(user.queryCount)} />
        <MetricCard label="Tokens" value={formatNumber(user.totalTokens)} />
        <MetricCard
          label="Estimated cost"
          value={`$${user.estimatedCostUsd.toFixed(4)}`}
        />
        <MetricCard
          label="Last active"
          value={user.lastActiveAt ? formatDate(user.lastActiveAt) : 'Never'}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <Panel
          title="Account controls"
          description="All changes are recorded in the immutable audit log."
        >
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <form action={setAccountStatus} className="space-y-3">
              <input type="hidden" name="userId" value={id} />
              <label className="block text-xs font-semibold">
                Access status
              </label>
              <select
                name="status"
                defaultValue={
                  user.accountStatus === 'suspended' ? 'suspended' : 'active'
                }
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <input
                name="reason"
                placeholder="Reason for change"
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              />
              <input
                type="datetime-local"
                name="suspendedUntil"
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              />
              <button className={buttonClass}>Update access</button>
            </form>
            <form action={setQuotaOverrides} className="space-y-3">
              <input type="hidden" name="userId" value={id} />
              <label className="block text-xs font-semibold">
                Daily quota overrides
              </label>
              <input
                type="number"
                name="quickDailyLimit"
                min="1"
                max="100000"
                defaultValue={user.quickDailyLimit}
                placeholder="Quick default"
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              />
              <input
                type="number"
                name="adaptiveDailyLimit"
                min="1"
                max="100000"
                defaultValue={user.adaptiveDailyLimit}
                placeholder="Adaptive default"
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              />
              <input
                name="reason"
                placeholder="Reason for change"
                className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
              />
              <button className={buttonClass}>Save quotas</button>
            </form>
          </div>
        </Panel>
        <Panel title="Account footprint">
          <div className="grid grid-cols-2 gap-px bg-black/7">
            {[
              ['Conversations', user.chatCount],
              ['Notes', user.noteCount],
              ['Files', user.fileCount],
              ['Feedback', user.feedbackCount]
            ].map(([label, value]) => (
              <div key={String(label)} className="bg-white/90 p-5">
                <p className="text-xs text-black/42">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-black/7 p-5 text-xs text-black/48">
            Storage: {(user.storageBytes / 1024 / 1024).toFixed(2)} MB
          </div>
        </Panel>
      </div>

      <Panel title="Recent queries" className="mt-5">
        <div className="divide-y divide-black/6">
          {detail.queries.slice(0, 25).map(query => (
            <div
              key={query.id}
              className="grid gap-3 p-5 lg:grid-cols-[180px_1fr_140px]"
            >
              <div>
                <StatusPill status={query.status} />
                <p className="mt-2 text-[10px] text-black/38">
                  {formatDate(query.startedAt)}
                </p>
              </div>
              <PromptReveal eventId={query.id} />
              <div className="text-xs text-black/48 lg:text-right">
                <p>{formatNumber(query.totalTokens ?? 0)} tokens</p>
                <p className="mt-1">{query.toolCalls} tool calls</p>
                <p className="mt-1">
                  ${(query.estimatedCostUsd ?? 0).toFixed(5)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Conversations">
          <div className="divide-y divide-black/6">
            {detail.chats.map((chat: any) => (
              <a
                key={chat.id}
                href={`/admin/conversations/${chat.id}`}
                className="block px-5 py-4 hover:bg-black/[0.02]"
              >
                <p className="text-sm font-semibold">{chat.title}</p>
                <p className="mt-1 text-xs text-black/40">
                  {formatDate(chat.updated_at)}
                </p>
              </a>
            ))}
          </div>
        </Panel>
        <Panel title="Files and notes">
          <div className="p-5 text-xs text-black/52">
            <p>{detail.files.length} recent files</p>
            <p className="mt-2">{detail.notes.length} recent notes</p>
            <p className="mt-2">{detail.feedback.length} feedback records</p>
          </div>
        </Panel>
      </div>

      <Panel
        title="Danger zone"
        description="Owner-only destructive operation."
        className="mt-5 border-red-200"
      >
        <form
          action={deleteUserAsAdmin}
          className="grid gap-3 p-5 lg:grid-cols-[1fr_1fr_auto]"
        >
          <input type="hidden" name="userId" value={id} />
          <input
            name="reason"
            required
            placeholder="Deletion reason"
            className="h-10 rounded-xl border border-red-200 bg-white px-3 text-sm"
          />
          <input
            name="confirmation"
            required
            placeholder={`Type DELETE ${id}`}
            className="h-10 rounded-xl border border-red-200 bg-white px-3 text-sm"
          />
          <button className="h-10 rounded-xl bg-red-700 px-4 text-xs font-semibold text-white">
            Delete account
          </button>
        </form>
      </Panel>
    </>
  )
}
