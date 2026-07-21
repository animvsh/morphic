import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { createClient } from '@insforge/sdk'

import './styles.css'

const INSFORGE_URL = 'https://insforge-production-68dc.up.railway.app'
const insforge = createClient({ baseUrl: INSFORGE_URL })

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}
type Source = { title: string; url: string; snippet?: string }
type Activity = {
  stage: 'connecting' | 'search' | 'reasoning' | 'writing'
  label: string
  detail: string
}
type SavedChat = {
  id: string
  title: string
  messages: Message[]
  updated_at: string
}
type User = {
  id: string
  email: string
  profile?: { name?: string } | null
}

function Logo() {
  return <span className="logo-mark" aria-label="brok" />
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'deep' | 'reason'>('deep')
  const [loading, setLoading] = useState(false)
  const [activity, setActivity] = useState<Activity>({
    stage: 'connecting',
    label: 'connecting to minimax',
    detail: 'opening a real stream'
  })
  const [streamingAnswer, setStreamingAnswer] = useState('')
  const [streamingSources, setStreamingSources] = useState<Source[]>([])
  const [error, setError] = useState('')
  const [followups, setFollowups] = useState<string[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [savedChats, setSavedChats] = useState<SavedChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isEmpty = messages.length === 0
  const name = user?.profile?.name || user?.email?.split('@')[0] || 'guest'

  useEffect(() => {
    let alive = true
    const refreshUser = async () => {
      const { data } = await insforge.auth.getCurrentUser()
      if (!alive) return
      setUser((data?.user as User | null) ?? null)
      setAuthReady(true)
    }
    refreshUser()
    const unsubscribe = insforge.auth.onAuthStateChange(() => refreshUser())
    if (!localStorage.getItem('brok-onboarded')) setOnboarding(true)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setSavedChats([])
      return
    }
    loadChats()
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, streamingAnswer])

  async function loadChats() {
    const { data } = await insforge.database
      .from('brok_cloud_chats')
      .select('id,title,messages,updated_at')
      .order('updated_at', { ascending: false })
      .limit(30)
    setSavedChats((data as SavedChat[] | null) ?? [])
  }

  async function persistChat(nextMessages: Message[]) {
    if (!user) return
    const id = activeChatId ?? crypto.randomUUID()
    const firstPrompt =
      nextMessages.find(message => message.role === 'user')?.content ??
      'new chat'
    const title = firstPrompt
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 7)
      .join(' ')
    if (activeChatId) {
      await insforge.database
        .from('brok_cloud_chats')
        .update({ messages: nextMessages, title })
        .eq('id', id)
        .eq('user_id', user.id)
    } else {
      await insforge.database.from('brok_cloud_chats').insert({
        id,
        user_id: user.id,
        title,
        messages: nextMessages
      })
      setActiveChatId(id)
    }
    await loadChats()
  }

  async function submit(text = input) {
    const clean = text.trim()
    if (!clean || loading) return
    const withUser: Message[] = [...messages, { role: 'user', content: clean }]
    setMessages(withUser)
    setInput('')
    setError('')
    setFollowups([])
    setStreamingAnswer('')
    setStreamingSources([])
    setActivity({
      stage: 'connecting',
      label: 'connecting to minimax',
      detail: 'opening a real stream'
    })
    setLoading(true)
    try {
      const privateMemory = user
        ? savedChats
            .filter(chat => chat.id !== activeChatId)
            .slice(0, 5)
            .map(chat => {
              const recent = (chat.messages ?? []).slice(-4)
              return `chat: ${chat.title}\n${recent
                .map(
                  message => `${message.role}: ${message.content.slice(0, 700)}`
                )
                .join('\n')}`
            })
            .join('\n\n')
        : ''
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: withUser,
          mode,
          memory: privateMemory
        })
      })
      if (!response.ok || !response.body)
        throw new Error('could not open the minimax stream')

      type StreamEvent = {
        type: 'status' | 'sources' | 'delta' | 'done' | 'error'
        stage?: Activity['stage']
        label?: string
        detail?: string
        text?: string
        answer?: string
        error?: string
        sources?: Source[]
        followups?: string[]
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let payload: StreamEvent | null = null
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        buffer += decoder.decode(chunk.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as StreamEvent
          if (
            event.type === 'status' &&
            event.stage &&
            event.label &&
            event.detail
          ) {
            setActivity({
              stage: event.stage,
              label: event.label,
              detail: event.detail
            })
          } else if (event.type === 'sources') {
            setStreamingSources(event.sources ?? [])
          } else if (event.type === 'delta' && event.text) {
            setStreamingAnswer(current => current + event.text)
          } else if (event.type === 'error') {
            throw new Error(event.error || 'try that again')
          } else if (event.type === 'done') {
            payload = event
          }
        }
      }
      if (!payload?.answer) throw new Error('minimax ended the stream early')
      const nextMessages: Message[] = [
        ...withUser,
        { role: 'assistant', content: payload.answer, sources: payload.sources }
      ]
      setMessages(nextMessages)
      setFollowups(payload.followups ?? [])
      setStreamingAnswer('')
      setStreamingSources([])
      await persistChat(nextMessages)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'something went sideways'
      )
    } finally {
      setLoading(false)
    }
  }

  function newChat() {
    setMessages([])
    setFollowups([])
    setError('')
    setStreamingAnswer('')
    setStreamingSources([])
    setActiveChatId(null)
    setSidebarOpen(false)
  }

  function openChat(chat: SavedChat) {
    setMessages(chat.messages ?? [])
    setActiveChatId(chat.id)
    setFollowups([])
    setSidebarOpen(false)
  }

  async function deleteChat(event: React.MouseEvent, id: string) {
    event.stopPropagation()
    await insforge.database.from('brok_cloud_chats').delete().eq('id', id)
    if (activeChatId === id) newChat()
    loadChats()
  }

  function finishOnboarding() {
    localStorage.setItem('brok-onboarded', 'true')
    setOnboarding(false)
  }

  async function signOut() {
    await insforge.auth.signOut()
    setUser(null)
    setSavedChats([])
    newChat()
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="brand" onClick={newChat} aria-label="new brok chat">
          <Logo />
          <span>brok</span>
        </button>
        <button className="new-chat" onClick={newChat}>
          ＋ <span>new chat</span>
        </button>
        <div className="history">
          {user ? (
            <>
              <p className="sidebar-label">your chats</p>
              {savedChats.map(chat => (
                <button
                  className="history-row"
                  key={chat.id}
                  onClick={() => openChat(chat)}
                >
                  <span>{chat.title}</span>
                  <i onClick={event => deleteChat(event, chat.id)}>×</i>
                </button>
              ))}
              {savedChats.length === 0 && (
                <p className="sidebar-empty">
                  your saved chats will live here.
                </p>
              )}
            </>
          ) : (
            <div className="guest-note">
              <span>☁</span>
              <p>sign in to keep your favorite chats.</p>
            </div>
          )}
        </div>
        <button
          className="account-small"
          onClick={() => (user ? signOut() : setAuthOpen(true))}
        >
          <span className="avatar">{name[0]}</span>
          <span>{user ? 'sign out' : 'sign in'}</span>
        </button>
      </aside>

      <section className="workspace">
        <header>
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(value => !value)}
          >
            ☰
          </button>
          <div className="header-actions">
            <button
              className="waitlist-button"
              onClick={() => setWaitlistOpen(true)}
            >
              get early access
            </button>
            <button
              className="profile-button"
              onClick={() => (user ? setSidebarOpen(true) : setAuthOpen(true))}
            >
              <span className="avatar">{authReady ? name[0] : '·'}</span>
              <span>{authReady ? name : '...'}</span>
            </button>
          </div>
        </header>

        <main className={isEmpty ? 'empty' : 'conversation'}>
          {isEmpty ? (
            <div className="hero">
              <div className="hero-logo">
                <Logo />
              </div>
              <p className="eyebrow">
                brok — ai that’s affordable, like really affordable
              </p>
              <h1>what can i help with?</h1>
              <Composer
                input={input}
                setInput={setInput}
                submit={submit}
                loading={loading}
                mode={mode}
                setMode={setMode}
              />
              <div className="starter-prompts">
                {[
                  'help me plan a quiet weekend',
                  'compare two ideas for me',
                  'explain something confusing'
                ].map(prompt => (
                  <button key={prompt} onClick={() => submit(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="thread">
              {messages.map((message, index) => (
                <article
                  className={`message ${message.role}`}
                  key={`${index}-${message.content.slice(0, 12)}`}
                >
                  <div className="message-avatar">
                    {message.role === 'assistant' ? <Logo /> : name[0]}
                  </div>
                  <div className="message-body">
                    <RichText text={message.content} />
                    {!!message.sources?.length && (
                      <div className="sources">
                        {message.sources.slice(0, 4).map(source => (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            key={source.url}
                          >
                            {source.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {!!streamingAnswer && (
                <article className="message assistant streaming-message">
                  <div className="message-avatar">
                    <Logo />
                  </div>
                  <div className="message-body">
                    <RichText text={streamingAnswer} />
                    {!!streamingSources.length && (
                      <div className="sources">
                        {streamingSources.slice(0, 4).map(source => (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            key={source.url}
                          >
                            {source.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )}
              {loading && <Thinking activity={activity} />}
              {error && (
                <div className="error-card">
                  {error}{' '}
                  <button
                    onClick={() => submit(messages.at(-1)?.content || '')}
                  >
                    retry
                  </button>
                </div>
              )}
              {!!followups.length && !loading && (
                <div className="followups">
                  {followups.map(item => (
                    <button key={item} onClick={() => submit(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </main>

        {!isEmpty && (
          <div className="bottom-composer">
            <Composer
              input={input}
              setInput={setInput}
              submit={submit}
              loading={loading}
              mode={mode}
              setMode={setMode}
            />
          </div>
        )}
        <footer>brok can make mistakes. please double-check responses.</footer>
      </section>

      {sidebarOpen && (
        <button
          className="scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="close menu"
        />
      )}
      {authOpen && (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onSignedIn={async () => {
            const { data } = await insforge.auth.getCurrentUser()
            setUser((data?.user as User | null) ?? null)
            setAuthOpen(false)
          }}
        />
      )}
      {waitlistOpen && (
        <WaitlistDialog onClose={() => setWaitlistOpen(false)} />
      )}
      {onboarding && <Onboarding onDone={finishOnboarding} />}
    </div>
  )
}

function Composer({
  input,
  setInput,
  submit,
  loading,
  mode,
  setMode
}: {
  input: string
  setInput: (value: string) => void
  submit: (value?: string) => void
  loading: boolean
  mode: 'deep' | 'reason'
  setMode: (value: 'deep' | 'reason') => void
}) {
  return (
    <div className="composer">
      <textarea
        value={input}
        onChange={event => setInput(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="ask anything"
        aria-label="ask brok"
        rows={2}
      />
      <div className="composer-tools">
        <div>
          <button
            className={mode === 'deep' ? 'active' : ''}
            onClick={() => setMode('deep')}
          >
            <span className="tool-icon">◎</span> deep search
          </button>
          <button
            className={mode === 'reason' ? 'active' : ''}
            onClick={() => setMode('reason')}
          >
            <span className="tool-icon">◇</span> reason
          </button>
        </div>
        <button
          className="send"
          onClick={() => submit()}
          disabled={!input.trim() || loading}
          aria-label="send"
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function Thinking({ activity }: { activity: Activity }) {
  return (
    <div
      className={`thinking ${activity.stage}`}
      role="status"
      aria-live="polite"
    >
      <span className="thinking-mark" aria-hidden="true">
        <Logo />
        <i className="orbit orbit-one" />
        <i className="orbit orbit-two" />
        {activity.stage === 'search' && <i className="radar-sweep" />}
      </span>
      <span className="thinking-copy">
        <strong key={`${activity.stage}-${activity.label}`}>
          {activity.label}
        </strong>
        <small>{activity.detail}</small>
      </span>
      <span className="thinking-pulse" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map(cell => cell.trim())
  const isSpecial = (line: string, next = '') =>
    !line.trim() ||
    /^#{1,3}\s/.test(line) ||
    /^---+$/.test(line.trim()) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    (line.trim().startsWith('|') && /^\|?[\s:|-]+\|?$/.test(next.trim()))

  for (let index = 0; index < lines.length; ) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) {
      index += 1
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (heading) {
      const Tag =
        heading[1].length === 1 ? 'h2' : heading[1].length === 2 ? 'h3' : 'h4'
      blocks.push(
        <Tag key={`heading-${index}`}>
          <InlineText text={heading[2]} />
        </Tag>
      )
      index += 1
      continue
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`rule-${index}`} />)
      index += 1
      continue
    }

    if (
      trimmed.startsWith('|') &&
      /^\|?[\s:|-]+\|?$/.test((lines[index + 1] || '').trim())
    ) {
      const headers = cells(trimmed)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(cells(lines[index]))
        index += 1
      }
      blocks.push(
        <div className="answer-table" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={cellIndex}>
                    <InlineText text={header} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    const listMatch = trimmed.match(/^([-*]|\d+\.)\s+(.+)/)
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1])
      const items: string[] = []
      const pattern = ordered ? /^\d+\.\s+(.+)/ : /^[-*]\s+(.+)/
      while (index < lines.length) {
        const match = lines[index].trim().match(pattern)
        if (!match) break
        items.push(match[1])
        index += 1
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag key={`list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineText text={item} />
            </li>
          ))}
        </Tag>
      )
      continue
    }

    const paragraph: string[] = [trimmed]
    index += 1
    while (
      index < lines.length &&
      !isSpecial(lines[index], lines[index + 1] || '')
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    blocks.push(
      <p key={`paragraph-${index}`}>
        <InlineText text={paragraph.join(' ')} />
      </p>
    )
  }

  return <div className="rich-text">{blocks}</div>
}

function InlineText({ text }: { text: string }) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={index}>{part.slice(2, -2)}</strong>
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={index}>{part.slice(1, -1)}</em>
      return <React.Fragment key={index}>{part}</React.Fragment>
    })
}

function AuthDialog({
  onClose,
  onSignedIn
}: {
  onClose: () => void
  onSignedIn: () => void
}) {
  const [signup, setSignup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (signup) {
        const { error } = await insforge.auth.signUp({
          email,
          password,
          name,
          autoConfirm: true
        })
        if (error) throw new Error(error.message)
      }
      const { error } = await insforge.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw new Error(error.message)
      onSignedIn()
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message.toLowerCase()
          : 'could not sign in'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="auth-card">
        <Logo />
        <h2>{signup ? 'make your brok account' : 'welcome back'}</h2>
        <p>
          {signup
            ? 'keep your chats, context, and good ideas close.'
            : 'pick up exactly where you left off.'}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              <span>your name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="what should brok call you?"
                required
              />
            </label>
          )}
          <label>
            <span>email</span>
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            <span>password</span>
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              placeholder="at least 8 characters"
              minLength={8}
              required
            />
          </label>
          {message && <p className="form-error">{message}</p>}
          <button className="primary" disabled={busy}>
            {busy ? 'one sec…' : signup ? 'create my account' : 'sign in'}
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => setSignup(value => !value)}
        >
          {signup
            ? 'already have an account? sign in'
            : 'new here? make an account'}
        </button>
      </div>
    </Modal>
  )
}

function WaitlistDialog({ onClose }: { onClose: () => void }) {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan })
    })
    const payload = (await response.json()) as {
      message?: string
      error?: string
    }
    setMessage(payload.message || payload.error || 'try again')
    setBusy(false)
  }
  return (
    <Modal onClose={onClose}>
      <div className="waitlist-card">
        <p className="eyebrow">brok, early</p>
        <h2>good ai. sane pricing.</h2>
        <p className="waitlist-intro">
          request the launch price now. no card, no pressure.
        </p>
        <div className="plans">
          <button
            className={plan === 'monthly' ? 'selected' : ''}
            onClick={() => setPlan('monthly')}
          >
            <b>$10</b>
            <span>each month</span>
          </button>
          <button
            className={plan === 'annual' ? 'selected' : ''}
            onClick={() => setPlan('annual')}
          >
            <b>$50</b>
            <span>for the whole year</span>
            <i>best deal</i>
          </button>
        </div>
        <form onSubmit={submit} className="waitlist-form">
          <input
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@email.com"
            required
          />
          <button className="primary" disabled={busy}>
            {busy ? 'saving…' : 'request this price'}
          </button>
        </form>
        {message && <p className="success-message">{message}</p>}
        <div className="coming-soon">
          <h3>next on brok</h3>
          <p>
            <span>01</span> sharing pages
          </p>
          <p>
            <span>02</span> workspaces, like perplexity
          </p>
          <p>
            <span>03</span> ai for email — send and receive email via chat
          </p>
          <strong>all coming up.</strong>
        </div>
      </div>
    </Modal>
  )
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const steps = useMemo(
    () => [
      {
        symbol: '◇',
        title: 'hi, i’m brok',
        copy: 'a calmer, much more affordable place to search, think, and figure things out.'
      },
      {
        symbol: '◎',
        title: 'go wide. or go deep.',
        copy: 'deep search checks the web. reason keeps its attention on you and the conversation.'
      },
      {
        symbol: '□',
        title: 'pick up where you left off',
        copy: 'an account keeps your chats and brings useful context into the next one.'
      }
    ],
    []
  )
  const current = steps[step]
  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-card">
        <button className="skip" onClick={onDone}>
          skip
        </button>
        <span className="onboarding-symbol">{current.symbol}</span>
        <p className="eyebrow">tiny tour · {step + 1}/3</p>
        <h2>{current.title}</h2>
        <p>{current.copy}</p>
        <div className="dots">
          {steps.map((_, index) => (
            <i className={index === step ? 'active' : ''} key={index} />
          ))}
        </div>
        <button
          className="primary"
          onClick={() => (step === 2 ? onDone() : setStep(step + 1))}
        >
          {step === 2 ? 'start asking' : 'keep going'}
        </button>
      </div>
    </div>
  )
}

function Modal({
  children,
  onClose
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={event => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="close">
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
