import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'
import { headers } from 'next/headers'

import { getCurrentUser, getCurrentUserId } from '@/lib/auth/get-current-user'
import { UserProvider } from '@/lib/contexts/user-context'
import { cn } from '@/lib/utils'

import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import Header from '@/components/header'
import { KeyboardShortcutHandler } from '@/components/keyboard-shortcut-handler'
import { LibraryProvider } from '@/components/library/library-context'
import { OnboardingDialog } from '@/components/onboarding-dialog'
import { PostHogProvider } from '@/components/posthog-provider'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

const title = 'brok'
const description = "ai that's affordable. like, really affordable."

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description
  },
  twitter: {
    title,
    description,
    card: 'summary_large_image'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1
}

// The shell contains account and sidebar state, so it must be rendered from
// the current InsForge session instead of being cached as a guest-only page.
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const requestHeaders = await headers()
  const requestHost =
    requestHeaders.get('x-brok-original-host') ??
    requestHeaders.get('x-forwarded-host') ??
    requestHeaders.get('host') ??
    ''
  const adminHost = new URL(
    process.env.NEXT_PUBLIC_ADMIN_URL ?? 'https://admin.brok.fyi'
  ).hostname
  const isAdminHost = requestHost.split(':')[0].toLowerCase() === adminHost
  const user = await getCurrentUser()

  const userId = user?.id ?? (await getCurrentUserId())

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'fixed inset-0 flex flex-col font-sans antialiased overflow-hidden',
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <PostHogProvider userId={user?.id ?? null}>
            <UserProvider hasUser={!!userId} user={user}>
              <SidebarProvider defaultOpen={!!userId}>
                <LibraryProvider>
                  {user && <AppSidebar user={user} />}
                  <KeyboardShortcutHandler />
                  <div className="flex flex-col flex-1 min-w-0">
                    <Header user={user} />
                    <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
                      <ArtifactRoot>{children}</ArtifactRoot>
                    </main>
                  </div>
                </LibraryProvider>
              </SidebarProvider>
              {user && !user.user_metadata.onboarding_completed && (
                <OnboardingDialog disabled={isAdminHost} />
              )}
            </UserProvider>
          </PostHogProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
