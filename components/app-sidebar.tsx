import { Suspense } from 'react'
import Link from 'next/link'

import type { AppUser } from '@/lib/insforge/auth'

import { IconLogo } from '@/components/ui/icons'
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
      className="border-r border-sidebar-border"
    >
      <SidebarHeader className="flex flex-row items-center justify-between px-2 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2 px-1">
          <IconLogo className="size-5 shrink-0" aria-label="brok labs" />
          <span className="truncate text-sm font-medium lowercase">
            brok labs
          </span>
        </Link>
        <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
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
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserMenu user={user} align="start" showLabel />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
