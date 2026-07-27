import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { AuthModal } from '../auth-modal'

// Regression test for ISSUE-001 found during the 2026-07-27 QA pass.
describe('AuthModal brok branding', () => {
  test('uses lowercase brok copy and the current guest-mode boundary', () => {
    render(<AuthModal open onOpenChange={() => undefined} />)

    expect(
      screen.getByRole('heading', { name: 'continue with brok' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'sign in to use reason mode. deep search stays available without an account.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/morphic/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'sign up' })).toHaveAttribute(
      'href',
      '/auth/sign-up'
    )
    expect(screen.getByRole('link', { name: 'sign in' })).toHaveAttribute(
      'href',
      '/auth/login'
    )
  })
})
