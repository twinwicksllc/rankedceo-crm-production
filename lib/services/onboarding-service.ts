import { createClient } from "@/lib/supabase/server";
import { resolveAccountId } from "@/lib/services/account-context";
import type {
  AccountInfo,
  OnboardingStatus,
  CompanyInfo,
} from "@/lib/types/onboarding";

export class OnboardingService {
  private async getUserInfo() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Not authenticated");
    }

    // users.id IS the auth uid; accounts has no user_id column. The helper
    // also covers a legacy profile whose id is not the auth id.
    const account_id = await resolveAccountId(supabase, user);

    return { user, account_id };
  }

  async getOnboardingStatus(): Promise<OnboardingStatus | null> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from("accounts")
      .select(
        "onboarding_completed, onboarding_step, onboarding_skipped, onboarding_completed_at",
      )
      .eq("id", account_id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch onboarding status: ${error.message}`);
    }

    return data;
  }

  async updateOnboardingStep(step: number): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from("accounts")
      .update({ onboarding_step: step })
      .eq("id", account_id);

    if (error) {
      throw new Error(`Failed to update onboarding step: ${error.message}`);
    }
  }

  async updateCompanyInfo(companyInfo: CompanyInfo): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from("accounts")
      .update({
        name: companyInfo.name,
        company_size: companyInfo.company_size,
        industry: companyInfo.industry,
        website: companyInfo.website,
        phone: companyInfo.phone,
        address: companyInfo.address,
      })
      .eq("id", account_id);

    if (error) {
      throw new Error(`Failed to update company info: ${error.message}`);
    }
  }

  async completeOnboarding(): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from("accounts")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_step: 5,
      })
      .eq("id", account_id);

    if (error) {
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }
  }

  async skipOnboarding(): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from("accounts")
      .update({
        onboarding_skipped: true,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", account_id);

    if (error) {
      throw new Error(`Failed to skip onboarding: ${error.message}`);
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch account info: ${error.message}`);
    }

    return data as AccountInfo;
  }
}
