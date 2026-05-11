'use server'

// =============================================================================
// lib/waas/actions/qa.ts
// Server actions for the QA Agent admin UI.
//
// Routes:
//   /admin/qa-reports    — list + view run reports
//   /admin/qa-scenarios  — manage scenarios (CRUD)
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QaRunSummary {
  id:           string
  run_id:       string
  run_tag:      string
  scenario:     string
  mode:         'smoke' | 'full'
  status:       'pass' | 'pass_with_findings' | 'error' | 'critical_halt' | 'running'
  started_at:   string
  completed_at: string
  total_steps:  number
  passed_steps: number
  finding_steps: number
  critical_step: string | null
  created_at:   string
}

export interface QaRunDetail extends QaRunSummary {
  findings:    unknown[]
  report_html: string | null
}

export interface QaScenario {
  id:              string
  scenario_id:     string
  name:            string
  description:     string | null
  modes:           string[]
  requires_stripe: boolean
  requires_email:  boolean
  yaml_content:    string
  step_count:      number
  is_active:       boolean
  created_by:      string | null
  updated_by:      string | null
  created_at:      string
  updated_at:      string
}

// ─── QA Runs ──────────────────────────────────────────────────────────────────

export async function listQaRuns(limit = 20): Promise<{ data: QaRunSummary[] | null; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('qa')
      .from('qa_runs')
      .select('id,run_id,run_tag,scenario,mode,status,started_at,completed_at,total_steps,passed_steps,finding_steps,critical_step,created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { data: null, error: error.message }
    return { data: data as QaRunSummary[] }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

export async function getQaRunDetail(runId: string): Promise<{ data: QaRunDetail | null; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('qa')
      .from('qa_runs')
      .select('*')
      .eq('run_id', runId)
      .maybeSingle()

    if (error) return { data: null, error: error.message }
    if (!data)  return { data: null, error: 'Run not found' }
    return { data: data as QaRunDetail }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

export async function purgeQaRuns(): Promise<{ purged: number; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('qa')
      .from('qa_runs')
      .delete()
      .like('run_tag', 'qa_agent_%')
      .select('id')

    if (error) return { purged: 0, error: error.message }
    revalidatePath('/admin/qa-reports')
    return { purged: (data as { id: string }[])?.length ?? 0 }
  } catch (e) {
    return { purged: 0, error: (e as Error).message }
  }
}

// ─── QA Scenarios ─────────────────────────────────────────────────────────────

export async function listQaScenarios(): Promise<{ data: QaScenario[] | null; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('qa')
      .from('qa_scenarios')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data as QaScenario[] }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

export async function createQaScenario(input: {
  scenario_id: string
  name: string
  description?: string
  modes: string[]
  requires_stripe: boolean
  requires_email: boolean
  yaml_content: string
  step_count: number
  admin_email: string
}): Promise<{ data: QaScenario | null; error?: string }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('qa')
      .from('qa_scenarios')
      .insert({
        scenario_id:     input.scenario_id,
        name:            input.name,
        description:     input.description ?? null,
        modes:           input.modes,
        requires_stripe: input.requires_stripe,
        requires_email:  input.requires_email,
        yaml_content:    input.yaml_content,
        step_count:      input.step_count,
        created_by:      input.admin_email,
        updated_by:      input.admin_email,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/admin/qa-scenarios')
    return { data: data as QaScenario }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

export async function updateQaScenario(id: string, input: {
  name?: string
  description?: string
  modes?: string[]
  requires_stripe?: boolean
  requires_email?: boolean
  yaml_content?: string
  step_count?: number
  is_active?: boolean
  admin_email: string
}): Promise<{ data: QaScenario | null; error?: string }> {
  try {
    const supabase = await createClient()
    const { admin_email, ...fields } = input
    const { data, error } = await supabase
      .schema('qa')
      .from('qa_scenarios')
      .update({ ...fields, updated_by: admin_email })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/admin/qa-scenarios')
    return { data: data as QaScenario }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

export async function deleteQaScenario(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .schema('qa')
      .from('qa_scenarios')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/admin/qa-scenarios')
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}
