import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OnboardingDialog } from '@/components/onboarding-dialog'

const navigation = vi.hoisted(() => ({
  pathname: '/',
  refresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: navigation.refresh })
}))

describe('OnboardingDialog', () => {
  beforeEach(() => {
    navigation.pathname = '/'
  })

  it('renders for the public application', () => {
    render(<OnboardingDialog />)
    expect(screen.getByTestId('brok-onboarding')).toBeInTheDocument()
  })

  it('does not block the admin application', () => {
    navigation.pathname = '/admin/users'
    render(<OnboardingDialog />)
    expect(screen.queryByTestId('brok-onboarding')).not.toBeInTheDocument()
  })
})
