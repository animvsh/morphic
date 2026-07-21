import { notFound } from 'next/navigation'

import { getAdminConversation } from '@/lib/admin/data'

import {
  formatDate,
  PageHeader,
  Panel,
  StatusPill
} from '@/components/admin/admin-ui'
import { PromptReveal } from '@/components/admin/prompt-reveal'

export default async function AdminConversationPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conversation = await getAdminConversation(id)
  if (!conversation) notFound()
  return (
    <>
      <PageHeader
        eyebrow="Conversation inspector"
        title={conversation.chat.title}
        description={`${id} · ${conversation.messages.length} messages · last updated ${formatDate(conversation.chat.updated_at)}`}
      />
      <Panel
        title="Message timeline"
        description="Message content remains concealed until each audited reveal."
      >
        <div className="divide-y divide-black/7">
          {(conversation.messages as any[]).map(message => {
            return (
              <article
                key={message.id}
                className="grid gap-4 p-5 lg:grid-cols-[170px_1fr]"
              >
                <div>
                  <StatusPill status={message.role} />
                  <p className="mt-2 break-all text-[10px] text-black/35">
                    {message.id}
                  </p>
                  <p className="mt-1 text-[10px] text-black/35">
                    {formatDate(message.created_at)}
                  </p>
                </div>
                <PromptReveal
                  eventId={message.id}
                  action="conversation.reveal"
                  targetType="conversation"
                />
              </article>
            )
          })}
        </div>
      </Panel>
    </>
  )
}
