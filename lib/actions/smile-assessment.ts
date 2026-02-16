'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export interface SubmitAssessmentData {
  patient_name: string
  patient_email: string
  patient_phone: string
  patient_dob: string
  dentist_name: string
  last_dental_visit: string
  dental_insurance: boolean
  insurance_provider: string
  current_concerns: string
  pain_sensitivity: string
  smile_goals: string[]
  desired_outcome: string
  medical_conditions: string[]
  medications: string
  allergies: string
  dentistId?: string // Optional: provided via public form URL
}

export interface SubmitAssessmentResult {
  success: boolean
  assessmentId?: string
  error?: string
}

/**
 * Server Action: Submit Smile Assessment
 * 
 * HIPAA Compliance:
 * - All PII is handled server-side only
 * - Data is inserted directly into Supabase with RLS protection
 * - No PII is logged or exposed in error messages
 * - Supports both authenticated dentist submissions and public patient submissions
 * 
 * Public Patient Flow:
 * - Patient visits link with dentistId in URL: /smile/assessment?dentistId=xxx
 * - Form submission includes dentistId
 * - Data is inserted using admin client (bypasses RLS for insert)
 * - RLS still protects reads (only dentist can view their assessments)
 */
export async function submitSmileAssessment(
  data: SubmitAssessmentData
): Promise<SubmitAssessmentResult> {
  try {
    const supabase = await createClient()
    
    // ── Determine if this is a public submission or authenticated dentist ──
    const isPublicSubmission = !!data.dentistId
    let targetUserId: string
    let accountId: string | null = null

    if (isPublicSubmission) {
      // Public patient submission: use dentistId from URL
      targetUserId = data.dentistId!
      
      // Get account_id for the dentist
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('account_id')
        .eq('auth_user_id', targetUserId)
        .single()

      if (userError || !userData) {
        return {
          success: false,
          error: 'Invalid dentist link. Please contact your dentist.',
        }
      }
      
      accountId = userData.account_id
    } else {
      // Authenticated dentist submission: use logged-in user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        return {
          success: false,
          error: 'Authentication required. Please log in.',
        }
      }

      targetUserId = user.id

      // Get user's account_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('account_id')
        .eq('auth_user_id', user.id)
        .single()

      if (userError || !userData) {
        return {
          success: false,
          error: 'Account not found. Please contact support.',
        }
      }
      
      accountId = userData.account_id
    }

    // ── 3. Insert assessment into database ────────────────────────────
    const { data: assessment, error: insertError } = await supabase
      .from('smile_assessments')
      .insert({
        account_id: accountId,
        user_id: targetUserId,
        patient_name: data.patient_name,
        patient_email: data.patient_email,
        patient_phone: data.patient_phone,
        patient_dob: data.patient_dob || null,
        dentist_name: data.dentist_name || null,
        last_dental_visit: data.last_dental_visit || null,
        dental_insurance: data.dental_insurance,
        insurance_provider: data.insurance_provider || null,
        current_concerns: data.current_concerns || null,
        pain_sensitivity: data.pain_sensitivity || null,
        smile_goals: data.smile_goals || [],
        desired_outcome: data.desired_outcome || null,
        medical_conditions: data.medical_conditions || [],
        medications: data.medications || null,
        allergies: data.allergies || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      // Log error without PII
      console.error('Assessment submission failed:', insertError.code)
      
      return {
        success: false,
        error: 'Failed to submit assessment. Please try again.',
      }
    }

    // ── 4. Revalidate paths ────────────────────────────────────────────
    revalidatePath('/smile')
    revalidatePath('/smile/assessment')

    return {
      success: true,
      assessmentId: assessment.id,
    }
  } catch (error) {
    // Generic error - no PII in logs
    console.error('Unexpected error during assessment submission')
    
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.',
    }
  }
}

/**
 * Server Action: Get user's assessments
 * 
 * HIPAA Compliance:
 * - Only returns assessments for the authenticated user
 * - RLS policies automatically filter results
 */
export async function getUserAssessments() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, data: [], error: 'Not authenticated' }
    }

    const { data: assessments, error } = await supabase
      .from('smile_assessments')
      .select('id, created_at, patient_name, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch assessments')
      return { success: false, data: [], error: 'Failed to load assessments' }
    }

    return { success: true, data: assessments, error: null }
  } catch (error) {
    console.error('Unexpected error fetching assessments')
    return { success: false, data: [], error: 'Unexpected error' }
  }
}
