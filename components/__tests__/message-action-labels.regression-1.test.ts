import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

// Regression coverage for the remaining ISSUE-003 controls found live.
describe('message action control names', () => {
  test('labels assistant response actions', () => {
    const source = readFileSync(
      join(process.cwd(), 'components/message-actions.tsx'),
      'utf8'
    )

    expect(source).toContain('aria-label="copy response"')
    expect(source).toContain('aria-label="mark response helpful"')
    expect(source).toContain('aria-label="mark response unhelpful"')
  })

  test('labels user message actions', () => {
    const source = readFileSync(
      join(process.cwd(), 'components/user-text-section.tsx'),
      'utf8'
    )

    expect(source).toContain(
      "aria-label={copied ? 'message copied' : 'copy message'}"
    )
    expect(source).toContain('aria-label="edit message"')
  })
})
