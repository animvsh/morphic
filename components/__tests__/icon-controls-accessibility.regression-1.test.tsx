import React from 'react'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ChatPanel } from '../chat-panel'
import { PasswordInput } from '../ui/password-input'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('../artifact/artifact-context', () => ({
  useArtifact: () => ({ close: vi.fn() })
}))

vi.mock('../action-buttons', () => ({
  ActionButtons: () => null
}))

vi.mock('../library/library-context', () => ({
  useLibrary: () => ({ upsertCachedFile: vi.fn() })
}))

vi.mock('../library/library-picker-dialog', () => ({
  LibraryPickerDialog: () => null
}))

vi.mock('../message-navigation-dots', () => ({
  MessageNavigationDots: () => null
}))

vi.mock('../model-selector-client', () => ({
  ModelSelectorClient: () => null
}))

vi.mock('../uploaded-file-list', () => ({
  UploadedFileList: () => null
}))

vi.mock('../ui/icons', () => ({
  IconBlinkingLogo: () => <span data-testid="blinking-logo" />,
  IconLogo: () => <span data-testid="brand-logo" />,
  IconLogoOutline: () => <span data-testid="adaptive-icon" />
}))

function renderPanel(
  status: 'ready' | 'submitted' | 'streaming',
  messages: React.ComponentProps<typeof ChatPanel>['messages'] = []
) {
  return render(
    <ChatPanel
      chatId="chat-1"
      input=""
      handleInputChange={vi.fn()}
      handleSubmit={vi.fn()}
      status={status}
      messages={messages}
      setMessages={vi.fn()}
      query=""
      stop={vi.fn()}
      append={vi.fn()}
      showScrollToBottomButton={false}
      scrollContainerRef={React.createRef<HTMLDivElement>()}
      uploadedFiles={[]}
      setUploadedFiles={vi.fn()}
      quotedContexts={[]}
      setQuotedContexts={vi.fn()}
      noteContexts={[]}
      setNoteContexts={vi.fn()}
      isGuest
      isCloudDeployment
    />
  )
}

afterEach(cleanup)

// Regression tests for ISSUE-003 found during the 2026-07-27 QA pass.
describe('icon-only control names', () => {
  test('names the composer send and stop actions', () => {
    const view = renderPanel('ready')
    expect(
      screen.getByRole('button', { name: 'send message' })
    ).toBeInTheDocument()

    view.unmount()
    renderPanel('streaming')
    expect(
      screen.getByRole('button', { name: 'stop response' })
    ).toBeInTheDocument()
  })

  test('names the new-chat action', () => {
    renderPanel('ready', [
      {
        id: 'message-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }]
      }
    ])

    expect(screen.getByRole('button', { name: 'new chat' })).toBeInTheDocument()
  })

  test('announces password visibility state', () => {
    render(<PasswordInput aria-label="password" />)

    const toggle = screen.getByRole('button', { name: 'show password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(
      screen.getByRole('button', { name: 'hide password' })
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
