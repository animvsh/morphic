'use client'

import { useState, useTransition } from 'react'

import { IconCopy, IconLinkOff, IconShare as Share } from '@tabler/icons-react'
import { toast } from 'sonner'

import { getChatShareState, shareChat, unshareChat } from '@/lib/actions/chat'
import { useCopyToClipboard } from '@/lib/hooks/use-copy-to-clipboard'

import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog'
import { Spinner } from './ui/spinner'

interface ChatShareProps {
  chatId: string
  className?: string
}

export function ChatShare({ chatId, className }: ChatShareProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const { copyToClipboard } = useCopyToClipboard({ timeout: 1000 })
  const [shareUrl, setShareUrl] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) return

    startTransition(async () => {
      const state = await getChatShareState(chatId)
      if (!state) {
        toast.error('could not load sharing settings')
        return
      }
      const publicNow = state.visibility === 'public'
      setIsPublic(publicNow)
      setShareUrl(
        publicNow
          ? new URL(`/search/${chatId}`, window.location.origin).toString()
          : ''
      )
    })
  }

  const handleShare = () => {
    startTransition(async () => {
      const sharedChat = await shareChat(chatId)
      if (!sharedChat) {
        toast.error('could not turn on link sharing')
        return
      }
      setIsPublic(true)
      setShareUrl(
        new URL(`/search/${sharedChat.id}`, window.location.origin).toString()
      )
      toast.success('link sharing is on')
    })
  }

  const handleCopy = () => {
    if (shareUrl) {
      copyToClipboard(shareUrl)
      toast.success('link copied')
    } else {
      toast.error('turn on link sharing first')
    }
  }

  const handleNativeShare = async () => {
    if (!shareUrl || !navigator.share) return handleCopy()
    await navigator.share({ title: 'chat by brok labs', url: shareUrl })
  }

  const handleUnshare = () => {
    startTransition(async () => {
      const privateChat = await unshareChat(chatId)
      if (!privateChat) {
        toast.error('could not make this chat private')
        return
      }
      setIsPublic(false)
      setShareUrl('')
      toast.success('chat is private again')
    })
  }

  return (
    <div className={className}>
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
        aria-labelledby="share-dialog-title"
        aria-describedby="share-dialog-description"
      >
        <DialogTrigger asChild>
          <Button
            size="icon"
            variant={'ghost'}
            className="size-11 rounded-full"
            aria-label="share chat"
          >
            <Share size={14} />
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="lowercase">share chat</DialogTitle>
            <DialogDescription className="lowercase">
              link sharing lets anyone with a brok account read this
              conversation. only you can change or continue it.
            </DialogDescription>
          </DialogHeader>
          {isPublic && shareUrl && (
            <div className="rounded-2xl border border-border bg-muted/45 p-3">
              <p className="truncate text-xs text-muted-foreground">
                {shareUrl}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {isPublic ? (
              <>
                <Button
                  onClick={handleUnshare}
                  disabled={pending}
                  size="sm"
                  variant="ghost"
                  className="min-h-11 gap-2 lowercase text-muted-foreground"
                >
                  <IconLinkOff size={15} />
                  make private
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopy}
                    disabled={pending}
                    size="sm"
                    variant="outline"
                    className="min-h-11 gap-2 lowercase"
                  >
                    <IconCopy size={15} />
                    copy
                  </Button>
                  <Button
                    onClick={handleNativeShare}
                    disabled={pending}
                    size="sm"
                    className="min-h-11 gap-2 lowercase"
                  >
                    <Share size={15} />
                    share
                  </Button>
                </div>
              </>
            ) : (
              <Button
                onClick={handleShare}
                disabled={pending}
                className="min-h-11 lowercase"
              >
                {pending ? <Spinner /> : 'turn on link sharing'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
