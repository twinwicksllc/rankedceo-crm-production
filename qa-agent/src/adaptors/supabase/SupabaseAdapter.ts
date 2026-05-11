/**
 * SupabaseAdapter — wraps the Supabase client for QA agent use.
 *
 * All queries operate in the `qa` schema (set via search_path).
 * Agent records are tagged with the runId prefix for easy identification and purge.
 *
 * Decision (Q2): Same Supabase project, `qa` schema.
 * Records prefixed `qa_agent_YYYYMMDD_HHMMSS_` for clean separation from real clients.
 */

import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createClient<any, any>>

export class SupabaseAdapter {
  private client: AnyClient

  constructor() {
    // The project uses WaaS-prefixed variable names because this Vercel project
    // serves both the WaaS product and the CRM product from the same deployment.
    // Accept both the short form (SUPABASE_URL) and the WaaS-prefixed form so
    // the GitHub Secret can be named either way.
    const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL ?? process.env.SUPABASE_URL
    const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        'Supabase credentials are required. Set either:\n' +
        '  NEXT_PUBLIC_WAAS_SUPABASE_URL + WAAS_SUPABASE_SERVICE_ROLE_KEY  (preferred)\n' +
        '  or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (fallback)',
      )
    }
    this.client = createClient(url, key, {
      db: { schema: 'qa' },
      auth: { persistSession: false },
      // Node.js 20 doesn't have native WebSocket — provide ws package as transport
      global: { fetch: fetch.bind(globalThis) },
      realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    })
  }

  /**
   * Count rows in a `qa` schema table matching the given conditions.
   */
  async countRows(table: string, where: Record<string, unknown>): Promise<number> {
    let query = this.client.from(table).select('*', { count: 'exact', head: true })
    for (const [col, val] of Object.entries(where)) {
      query = query.eq(col, val as string)
    }
    const { count, error } = await query
    if (error) throw new Error(`SupabaseAdapter.countRows error: ${error.message}`)
    return count ?? 0
  }

  /**
   * Insert a row into a `qa` schema table.
   */
  async insert(table: string, row: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.from(table).insert(row)
    if (error) throw new Error(`SupabaseAdapter.insert error: ${error.message}`)
  }

  /**
   * Select rows from a `qa` schema table.
   */
  async select(table: string, where: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    let query = this.client.from(table).select('*')
    for (const [col, val] of Object.entries(where)) {
      query = query.eq(col, val as string)
    }
    const { data, error } = await query
    if (error) throw new Error(`SupabaseAdapter.select error: ${error.message}`)
    return (data as Record<string, unknown>[]) ?? []
  }

  /**
   * Purge all rows in a `qa` schema table where the tag column starts with `qa_agent_`.
   * Used by the admin purge action in Sprint 3.
   */
  async purgeAgentRecords(table: string, tagColumn = 'run_tag'): Promise<number> {
    const { data, error } = await this.client
      .from(table)
      .delete()
      .like(tagColumn, 'qa_agent_%')
      .select('id')
    if (error) throw new Error(`SupabaseAdapter.purgeAgentRecords error: ${error.message}`)
    return (data as { id: string }[])?.length ?? 0
  }

  /**
   * Build a run tag from the current timestamp.
   * Format: qa_agent_YYYYMMDD_HHMMSS
   */
  static buildRunTag(runId: string): string {
    return `qa_agent_${runId}`
  }
}
