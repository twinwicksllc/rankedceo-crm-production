"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  publicDentistId,
  resolveSmileTarget,
} from "@/lib/actions/smile-assessment-target";

export interface SubmitAssessmentData {
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  patient_dob: string;
  dentist_name: string;
  last_dental_visit: string;
  dental_insurance: boolean;
  insurance_provider: string;
  current_concerns: string;
  pain_sensitivity: string;
  smile_goals: string[];
  desired_outcome: string;
  medical_conditions: string[];
  medications: string;
  allergies: string;
  dentistId?: string; // Optional: provided via public form URL
}

export interface SubmitAssessmentResult {
  success: boolean;

  error?: string;
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
 * Which account receives the assessment is decided by resolveSmileTarget
 * (lib/actions/smile-assessment-target.ts):
 * - Public link (/smile/assessment?dentistId=xxx): the Smile Pool Account,
 *   with the dentist id kept in auth_user_id. The anon insert policy only
 *   allows the pool account.
 * - Signed-in dentist: their own account, resolved by users.id. If they
 *   have no profile, nothing is inserted and an error is returned.
 * - Neither: the Smile Pool Account, with auth_user_id null.
 */
export async function submitSmileAssessment(
  data: SubmitAssessmentData,
): Promise<SubmitAssessmentResult> {
  try {
    const supabase = await createClient();

    // ── 1. Who is submitting (only needed when there is no public dentistId) ─
    const dentistId = publicDentistId(data.dentistId);
    let user: { id: string; email?: string | null } | null = null;
    if (!dentistId) {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      user = authError ? null : auth.user;
    }

    // ── 2. Which account receives it ─────────────────────────────────────────
    const target = await resolveSmileTarget(supabase, { dentistId, user });
    if ("error" in target) {
      return { success: false, error: target.error };
    }

    // ── 3. Insert assessment into database ────────────────────────────────────
    const { error: insertError } = await supabase
      .from("smile_assessments")
      .insert({
        account_id: target.accountId,
        auth_user_id: target.authUserId,
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
        status: "pending",
      });

    if (insertError) {
      // Log error with more details for debugging
      console.error("[Smile Assessment] Submission failed:", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });

      // Return detailed error for debugging (in production, sanitize this)
      const errorMessage = `Error ${insertError.code}: ${insertError.message}`;
      console.error(
        "[Smile Assessment] Returning error to client:",
        errorMessage,
      );

      // Provide specific error messages
      if (insertError.code === "42P01") {
        return {
          success: false,
          error: "Database table not found. Please contact support.",
        };
      }

      if (insertError.code === "23503") {
        return {
          success: false,
          error: "Account not found. Please contact support.",
        };
      }

      if (insertError.code === "23502") {
        return {
          success: false,
          error: "Missing required field. Please fill all required fields.",
        };
      }

      return {
        success: false,
        error: "Failed to submit assessment. Please try again.",
      };
    }

    // ── 4. Revalidate paths ──────────────────────────────────────────────────
    revalidatePath("/smile");
    revalidatePath("/smile/assessment");

    return {
      success: true,
    };
  } catch {
    // Generic error - no PII in logs
    console.error("[Smile Assessment] Unexpected error during submission");

    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, data: [], error: "Not authenticated" };
    }

    const { data: assessments, error } = await supabase
      .from("smile_assessments")
      .select("id, created_at, patient_name, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Smile Assessment] Failed to fetch assessments");
      return { success: false, data: [], error: "Failed to load assessments" };
    }

    return { success: true, data: assessments, error: null };
  } catch {
    console.error("[Smile Assessment] Unexpected error fetching assessments");
    return { success: false, data: [], error: "Unexpected error" };
  }
}
