import { useAppUser } from '@/lib/contexts/user-context'

export const useCurrentUserName = () => {
  const user = useAppUser()
  return String(
    user?.user_metadata.full_name ??
      user?.user_metadata.name ??
      user?.email ??
      '?'
  )
}
