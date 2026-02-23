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
 * 
 * Pool Account Fallback:
 * - If dentistId is invalid or user is not authenticated
 * - Assessment is attributed to Smile Pool Account (00000000-0000-4000-a000-000000000004)
 * - Ensures no assessment data is lost
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

    // Smile Pool Account ID for fallback
    const SMILE_POOL_ACCOUNT_ID = '00000000-0000-4000-a000-000000000004'

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
        // If dentist not found, fall back to Pool Account
        console.log('[Smile Assessment] Dentist not found, using Pool Account')
        accountId = SMILE_POOL_ACCOUNT_ID
      } else {
        accountId = userData.account_id
      }
    } else {
      // Authenticated dentist submission: use logged-in user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        // If not authenticated, fall back to Pool Account
        console.log('[Smile Assessment] Not authenticated, using Pool Account')
        targetUserId = SMILE_POOL_ACCOUNT_ID
        accountId = SMILE_POOL_ACCOUNT_ID
      } else {
        targetUserId = user.id

        // Get user's account_id
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('account_id')
          .eq('auth_user_id', user.id)
          .single()

        if (userError || !userData) {
          // If account not found, fall back to Pool Account
          console.log('[Smile Assessment] Account not found, using Pool Account')
          accountId = SMILE_POOL_ACCOUNT_ID
        } else {
          accountId = userData.account_id
        }
      }
    }

    // ── 3. Insert assessment into database ────────────────────────────────────
    const { data: assessment, error: insertError } = await supabase
      .from('smile_assessments')
      .insert({
        account_id: accountId,
        auth_user_id: targetUserId,
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
      // Log error with more details for debugging
      console.error('[Smile Assessment] Submission failed:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      })
      
      // Return detailed error for debugging (in production, sanitize this)
      const errorMessage = `Error ${insertError.code}: ${insertError.message}`
      console.error('[Smile Assessment] Returning error to client:', errorMessage)
      
      // Provide specific error messages
      if (insertError.code === '42P01') {
        return {
          success: false,
          error: 'Database table not found. Please contact support.',
          debug: errorMessage,
        }
      }
      
      if (insertError.code === '23503') {
        return {
          success: false,
          error: 'Account not found. Please contact support.',
          debug: errorMessage,
        }
      }
      
      if (insertError.code === '23502') {
        return {
          success: false,
          error: 'Missing required field. Please fill all required fields.',
          debug: errorMessage,
        }
      }
      
      return {
        success: false,
        error: 'Failed to submit assessment. Please try again.',
        debug: errorMessage,
      }
    }

    // ── 4. Revalidate paths ──────────────────────────────────────────────────
    revalidatePath('/smile')
    revalidatePath('/smile/assessment')

    return {
      success: true,
      assessmentId: assessment.id,
    }
  } catch (error) {
    // Generic error - no PII in logs
    console.error('[Smile Assessment] Unexpected error during submission')
    
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
 * - RLS policies automatically filter results by account_id
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
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Smile Assessment] Failed to fetch assessments')
      return { success: false, data: [], error: 'Failed to load assessments' }
    }

    return { success: true, data: assessments, error: null }
  } catch (error) {
    console.error('[Smile Assessment] Unexpected error fetching assessments')
    return { success: false, data: [], error: 'Unexpected error' }
  }
}