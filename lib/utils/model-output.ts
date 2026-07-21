const THINK_BLOCK_PATTERN = /<think>[\s\S]*?<\/think>/gi
const DANGLING_THINK_PATTERN = /<think>[\s\S]*$/i

export function stripThinkBlocks(value: string): string {
  return (
    value
      .replace(THINK_BLOCK_PATTERN, '')
      // MiniMax streams the opening tag before its closing tag. Hide that
      // incomplete block instead of flashing private working notes in the UI.
      .replace(DANGLING_THINK_PATTERN, '')
      .replace(/<\/?think>/gi, '')
      .trim()
  )
}

export function cleanGeneratedTitle(value: string): string {
  const withoutThinking = stripThinkBlocks(value)
  const firstLine = withoutThinking
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean)

  if (!firstLine) return ''

  return firstLine
    .replace(/^#{1,6}\s*/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/[*_`~]/g, '')
    .split(/\s+/)
    .slice(0, 10)
    .join(' ')
}
