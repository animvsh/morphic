import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'migrations/20260721231500_brok-admin-panel.sql'),
  'utf8'
)

describe('Brok admin database security', () => {
  it('enables RLS and revokes ordinary-user access for every admin table', () => {
    for (const table of [
      'brok_admin_memberships',
      'brok_account_controls',
      'brok_model_rates',
      'brok_request_events',
      'brok_admin_audit_log'
    ]) {
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`
      )
      expect(migration).toContain(
        `REVOKE ALL ON public.${table} FROM anon, authenticated`
      )
    }
  })

  it('makes the audit log append-only at both privilege and trigger layers', () => {
    expect(migration).toContain('brok_admin_audit_append_only')
    expect(migration).toContain(
      'REVOKE UPDATE, DELETE, TRUNCATE ON public.brok_admin_audit_log FROM project_admin'
    )
  })

  it('uses an explicit safe auth-user projection', () => {
    const view = migration.slice(
      migration.indexOf(
        'CREATE OR REPLACE VIEW public.brok_admin_user_directory'
      ),
      migration.indexOf('REVOKE ALL ON public.brok_admin_user_directory')
    )
    expect(view).not.toMatch(/password|access_token|refresh_token|api_key/i)
    expect(view).toContain('user_row.email')
    expect(view).toContain("user_row.profile->>'full_name'")
  })

  it('preserves legacy queries while marking metrics as not recorded', () => {
    expect(migration).toContain(
      'metrics_recorded BOOLEAN NOT NULL DEFAULT TRUE'
    )
    expect(migration).toContain('FALSE\nFROM public.brok_messages AS message')
  })
})
