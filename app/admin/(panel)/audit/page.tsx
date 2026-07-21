import { listAuditLog } from '@/lib/admin/data'

import { formatDate, PageHeader, Panel } from '@/components/admin/admin-ui'

export default async function AuditLogPage() {
  const rows = await listAuditLog()
  return (
    <>
      <PageHeader
        eyebrow="Immutable record"
        title="Audit log"
        description="Append-only sensitive reveals, exports, access changes, quota changes, triage actions, role mutations, and deletions."
      />
      <Panel title={`${rows.length} recent events`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-black/[0.025] text-[10px] uppercase tracking-wide text-black/40">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-5 py-3">Reason / change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/6">
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 text-black/45">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="px-4 py-4 font-semibold">{row.action}</td>
                  <td className="px-4 py-4 font-mono text-[10px]">
                    {row.actor_user_id ?? 'deleted actor'}
                  </td>
                  <td className="px-4 py-4">
                    <p>{row.target_type}</p>
                    <p className="mt-1 max-w-48 truncate font-mono text-[10px] text-black/40">
                      {row.target_id}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-black/48">
                    <p>{row.reason ?? '—'}</p>
                    {row.after_state && (
                      <pre className="mt-2 max-w-sm overflow-hidden text-[9px]">
                        {JSON.stringify(row.after_state)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
