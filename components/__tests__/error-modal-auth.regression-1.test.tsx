import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { ErrorModal } from '../error-modal'

// Regression test for the active ISSUE-001 path found during live acceptance.
describe('ErrorModal auth branding', () => {
  test('normalizes legacy auth errors to current lowercase brok copy', () => {
    render(
      <ErrorModal
        open
        onOpenChange={() => undefined}
        error={{
          type: 'auth',
          message:
            'Sign in to use Adaptive mode. Quick mode remains available without an account.'
        }}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'continue with brok' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'sign in to use reason mode. deep search stays available without an account.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/morphic|adaptive mode/i)).not.toBeInTheDocument()
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
