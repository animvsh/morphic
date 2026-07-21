import { requireBrokAdminPage } from '@/lib/admin/auth'

import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminPanelLayout({
  children
}: {
  children: React.ReactNode
}) {
  const actor = await requireBrokAdminPage('view')
  return <AdminShell actor={actor}>{children}</AdminShell>
}
