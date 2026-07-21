'use client'

import { createContext, useContext } from 'react'

import type { AppUser } from '@/lib/insforge/auth'

const UserContext = createContext(false)
const AppUserContext = createContext<AppUser | null>(null)

export function UserProvider({
  hasUser,
  user,
  children
}: {
  hasUser: boolean
  user: AppUser | null
  children: React.ReactNode
}) {
  return (
    <UserContext.Provider value={hasUser}>
      <AppUserContext.Provider value={user}>{children}</AppUserContext.Provider>
    </UserContext.Provider>
  )
}

export function useHasUser() {
  return useContext(UserContext)
}

export function useAppUser() {
  return useContext(AppUserContext)
}
