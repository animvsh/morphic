import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

// Regression test for ISSUE-002 found during the 2026-07-27 QA pass.
describe('public social metadata origin', () => {
  test('sets metadataBase to the public chat origin', () => {
    const source = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')

    expect(source).toContain(
      "metadataBase: new URL('https://chat.brok.fyi')"
    )
    expect(source).not.toContain("metadataBase: new URL('http://localhost")
  })
})
