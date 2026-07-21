import { listAdminFiles } from '@/lib/admin/data'

import {
  EmptyState,
  formatDate,
  MetricCard,
  PageHeader,
  Panel
} from '@/components/admin/admin-ui'

export default async function AdminFilesPage() {
  const files = await listAdminFiles()
  const storageBytes = files.reduce(
    (sum: number, file: any) => sum + Number(file.size ?? 0),
    0
  )
  const types = new Set(files.map((file: any) => file.media_type)).size
  return (
    <>
      <PageHeader
        eyebrow="Storage reporting"
        title="Files"
        description="Library object metadata by owner, type, size, conversation, and upload time. Object keys and storage credentials are never exposed."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Files" value={String(files.length)} />
        <MetricCard
          label="Storage"
          value={`${(storageBytes / 1024 / 1024).toFixed(2)} MB`}
        />
        <MetricCard label="Media types" value={String(types)} />
      </div>
      <Panel title="Recent library objects" className="mt-5">
        {files.length === 0 ? (
          <EmptyState>No stored files.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="bg-black/[0.025] text-[10px] uppercase tracking-wide text-black/40">
                <tr>
                  <th className="px-5 py-3">File</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Size</th>
                  <th className="px-5 py-3 text-right">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {files.map((file: any) => (
                  <tr key={file.id}>
                    <td className="px-5 py-4 font-semibold">{file.filename}</td>
                    <td className="px-4 py-4 font-mono text-[10px] text-black/45">
                      {file.user_id}
                    </td>
                    <td className="px-4 py-4">{file.media_type}</td>
                    <td className="px-4 py-4 text-right">
                      {(Number(file.size ?? 0) / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-5 py-4 text-right text-black/45">
                      {formatDate(file.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
