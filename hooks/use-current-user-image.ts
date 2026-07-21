import { useAppUser } from '@/lib/contexts/user-context'

export const useCurrentUserImage = () => {
  return useAppUser()?.user_metadata.avatar_url ?? null
}
