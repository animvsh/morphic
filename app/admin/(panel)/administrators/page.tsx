import { setAdminMembership } from '@/lib/admin/actions'
import { listAdminMemberships, listAdminUsers } from '@/lib/admin/data'

import {
  buttonClass,
  formatDate,
  PageHeader,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'

export default async function AdministratorsPage() {
  const [memberships, users] = await Promise.all([
    listAdminMemberships(),
    listAdminUsers({ pageSize: 100 })
  ])
  const userMap = new Map(users.items.map(user => [user.id, user]))
  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Administrators"
        description="Owner-managed Brok roles. The database prevents disabling or removing the final active owner."
      />
      <Panel title={`${memberships.length} memberships`}>
        <div className="divide-y divide-black/7">
          {memberships.map((membership: any) => {
            const user = userMap.get(membership.user_id)
            return (
              <form
                key={membership.user_id}
                action={setAdminMembership}
                className="grid items-center gap-3 p-5 lg:grid-cols-[1fr_150px_150px_auto]"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {user?.name ?? membership.user_id}
                  </p>
                  <p className="mt-1 text-xs text-black/42">
                    {user?.email ?? membership.user_id} · added{' '}
                    {formatDate(membership.created_at)}
                  </p>
                </div>
                <input type="hidden" name="userId" value={membership.user_id} />
                <select
                  name="role"
                  defaultValue={membership.role}
                  className="h-9 rounded-xl border border-black/10 bg-white px-2 text-xs"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="read_only">Read only</option>
                </select>
                <select
                  name="status"
                  defaultValue={membership.status}
                  className="h-9 rounded-xl border border-black/10 bg-white px-2 text-xs"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
                <button className={buttonClass}>Save</button>
              </form>
            )
          })}
        </div>
      </Panel>
      <Panel
        title="Add membership"
        description="Use a production auth user ID from the Users screen."
        className="mt-5"
      >
        <form
          action={setAdminMembership}
          className="grid gap-3 p-5 lg:grid-cols-[1fr_160px_160px_auto]"
        >
          <input
            name="userId"
            required
            placeholder="User UUID"
            className="h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
          />
          <select
            name="role"
            defaultValue="read_only"
            className="h-10 rounded-xl border border-black/10 bg-white px-2 text-sm"
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="support">Support</option>
            <option value="read_only">Read only</option>
          </select>
          <select
            name="status"
            defaultValue="active"
            className="h-10 rounded-xl border border-black/10 bg-white px-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <button className={buttonClass}>Add</button>
        </form>
      </Panel>
    </>
  )
}
