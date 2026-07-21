import { setFeedbackStatus, setWaitlistStatus } from '@/lib/admin/actions'
import { listFeedback, listWaitlist } from '@/lib/admin/data'

import {
  buttonClass,
  EmptyState,
  formatDate,
  PageHeader,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'

export default async function AdminFeedbackPage() {
  const [feedback, waitlist] = await Promise.all([
    listFeedback(),
    listWaitlist()
  ])
  return (
    <>
      <PageHeader
        eyebrow="Support queue"
        title="Feedback & waitlist"
        description="Triage user reports and move waitlist requests through their operational lifecycle."
      />
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel title={`${feedback.length} feedback records`}>
          {feedback.length === 0 ? (
            <EmptyState>No feedback submitted.</EmptyState>
          ) : (
            <div className="divide-y divide-black/7">
              {feedback.map((item: any) => (
                <article key={item.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusPill status={item.status ?? 'open'} />
                      <span className="text-xs font-semibold capitalize">
                        {item.sentiment}
                      </span>
                    </div>
                    <span className="text-[10px] text-black/38">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6">{item.message}</p>
                  <p className="mt-2 break-all text-[10px] text-black/38">
                    {item.page_url}
                  </p>
                  <form
                    action={setFeedbackStatus}
                    className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr_auto]"
                  >
                    <input type="hidden" name="feedbackId" value={item.id} />
                    <select
                      name="status"
                      defaultValue={item.status ?? 'open'}
                      className="h-9 rounded-xl border border-black/10 bg-white px-2 text-xs"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                    <input
                      name="note"
                      defaultValue={item.resolution_note ?? ''}
                      placeholder="Resolution note"
                      className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs"
                    />
                    <button className={buttonClass}>Save</button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={`${waitlist.length} waitlist requests`}>
          <div className="divide-y divide-black/7">
            {waitlist.map((item: any) => (
              <form key={item.email} action={setWaitlistStatus} className="p-5">
                <input type="hidden" name="email" value={item.email} />
                <p className="truncate text-sm font-semibold">{item.email}</p>
                <p className="mt-1 text-[10px] text-black/38">
                  {item.plan} · {formatDate(item.created_at)}
                </p>
                <div className="mt-3 flex gap-2">
                  <select
                    name="status"
                    defaultValue={item.status}
                    className="h-9 flex-1 rounded-xl border border-black/10 bg-white px-2 text-xs"
                  >
                    <option value="requested">Requested</option>
                    <option value="invited">Invited</option>
                    <option value="active">Active</option>
                  </select>
                  <button className={buttonClass}>Update</button>
                </div>
              </form>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}
