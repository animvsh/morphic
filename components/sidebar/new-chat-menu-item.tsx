'use client'

import Link from 'next/link'

import { IconPlus as Plus } from '@tabler/icons-react'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function NewChatMenuItem() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className="min-h-11 lowercase">
        <Link href="/" className="flex items-center gap-2">
          <Plus className="size-4" />
          <span>new chat</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
