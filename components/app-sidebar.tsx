import { Suspense } from 'react'
import Link from 'next/link'

import type { AppUser } from '@/lib/insforge/auth'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'

import UserMenu from '@/components/user-menu'

import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'
import { NewChatMenuItem } from './sidebar/new-chat-menu-item'

export default function AppSidebar({ user }: { user: AppUser }) {
  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="icon"
      className="border-r border-black/[0.06]"
    >
      <SidebarHeader className="flex flex-row items-center justify-between px-2 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 px-1">
          <span
            className="size-5 shrink-0 rounded-[6px] bg-black shadow-[0_1px_0_rgba(255,255,255,0.28)_inset]"
            aria-label="brok"
          />
          <span className="truncate text-sm font-medium lowercase">brok</span>
        </Link>
        <SidebarTrigger className="shrink-0 text-black/45 hover:text-black" />
      </SidebarHeader>
      <SidebarContent className="flex h-full flex-col px-2 py-2">
        <SidebarMenu>
          <NewChatMenuItem />
        </SidebarMenu>
        <div className="flex-1 overflow-y-auto group-data-[collapsible=icon]:hidden">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-black/[0.05] p-2">
        <UserMenu user={user} align="start" showLabel />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
