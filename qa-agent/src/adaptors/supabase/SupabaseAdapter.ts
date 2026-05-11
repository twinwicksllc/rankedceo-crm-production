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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createClient<any, any>>

export class SupabaseAdapter {
  private client: AnyClient

  constructor() {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }
    this.client = createClient(url, key, {
      db: { schema: 'qa' },
      auth: { persistSession: false },
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
