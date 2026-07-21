import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const streamdownMock = vi.hoisted(() => vi.fn(({ children }) => children))

vi.mock('streamdown', () => ({
  defaultRehypePlugins: {},
  Streamdown: streamdownMock
}))

vi.mock('@streamdown/math', () => ({ math: {} }))

vi.mock('@/lib/render/streamdown-spec', () => ({
  mergeStreamdownSpecRenderer: () => ({})
}))

import { MarkdownMessage } from '../message'

describe('MarkdownMessage streaming motion', () => {
  it('animates only incoming words and exposes a live caret', () => {
    render(<MarkdownMessage message="hello, world" isAnimating />)

    expect(streamdownMock).toHaveBeenCalled()
    expect(streamdownMock.mock.calls[0][0]).toMatchObject({
      isAnimating: true,
      caret: 'circle',
      animated: {
        animation: 'blurIn',
        duration: 150,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
        sep: 'word',
        stagger: 8
      }
    })
  })
})
