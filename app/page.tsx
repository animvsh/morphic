import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export default async function Page() {
  const userId = await getCurrentUserId()
  if (!userId) {
    redirect('/auth/login?next=%2F')
  }

  const isCloudDeployment = process.env.MORPHIC_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      isCloudDeployment={isCloudDeployment}
      libraryAvailable
      modelSelectorData={modelSelectorData}
    />
  )
}
