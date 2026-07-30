'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { IconBooks, IconFolders } from '@tabler/icons-react'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'

import { useLibrary } from '@/components/library/library-context'

export function SidebarPrimaryNav() {
  const pathname = usePathname()
  const { openLibrary } = useLibrary()

  return (
    <SidebarMenu className="mt-1">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={pathname.startsWith('/projects')}
          tooltip="projects"
          className="min-h-11 lowercase"
        >
          <Link href="/projects">
            <IconFolders size={18} />
            <span>projects</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={openLibrary}
          tooltip="library"
          className="min-h-11 lowercase"
        >
          <IconBooks size={18} />
          <span>library</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
