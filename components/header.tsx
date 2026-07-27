'use client'

import Link from 'next/link'

import type { AppUser } from '@/lib/insforge/auth'

import UserMenu from './user-menu'
import { WaitlistDialog } from './waitlist-dialog'

interface HeaderProps {
  user: AppUser | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="pointer-events-none absolute right-0 top-0 z-20 flex w-full items-center justify-end p-3 md:p-4">
      <div className="pointer-events-auto flex items-center gap-2">
        {user ? (
          <UserMenu user={user} />
        ) : (
          <>
            <WaitlistDialog />
            <Link
              href="/auth/login"
              className="rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-medium lowercase text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/45 hover:bg-accent"
            >
              sign in
            </Link>
          </>
        )}
      </div>
    </header>
  )
}

export default Header
