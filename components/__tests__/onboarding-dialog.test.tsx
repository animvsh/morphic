import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OnboardingDialog } from '@/components/onboarding-dialog'

const navigation = vi.hoisted(() => ({
  refresh: vi.fn()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: navigation.refresh })
}))

describe('OnboardingDialog', () => {
  it('renders for the public application', () => {
    render(<OnboardingDialog />)
    expect(screen.getByTestId('brok-onboarding')).toBeInTheDocument()
  })

  it('does not block the admin application', () => {
    render(<OnboardingDialog disabled />)
    expect(screen.queryByTestId('brok-onboarding')).not.toBeInTheDocument()
  })
})
