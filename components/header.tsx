import type { AppUser } from '@/lib/insforge/auth'

import UserMenu from './user-menu'

interface HeaderProps {
  user: AppUser | null
}

export function Header({ user }: HeaderProps) {
  if (!user) return null

  return (
    <header className="pointer-events-none absolute right-0 top-0 z-20 flex w-full items-center justify-end p-3 md:p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        <UserMenu user={user} />
      </div>
    </header>
  )
}

export default Header
