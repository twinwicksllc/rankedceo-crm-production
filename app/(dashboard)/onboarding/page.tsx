import { createClient } from '@/lib/supabase/server';
import { OnboardingService } from '@/lib/services/onboarding-service';
import { redirect } from 'next/navigation';
import { WelcomeStep } from '@/components/onboarding/welcome-step';
import { CompanyInfoStep } from '@/components/onboarding/company-info-step';
import { TeamSetupStep } from '@/components/onboarding/team-setup-step';
import { PreferencesStep } from '@/components/onboarding/preferences-step';
import { CompleteStep } from '@/components/onboarding/complete-step';
import { ProgressIndicator } from '@/components/onboarding/progress-indicator';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const onboardingService = new OnboardingService();
  
  let status;
  let accountInfo;
  
  try {
    [status, accountInfo] = await Promise.all([
      onboardingService.getOnboardingStatus(),
      onboardingService.getAccountInfo(),
    ]);
  } catch (error) {
    console.error('Error fetching onboarding status:', error);
    redirect('/dashboard');
  }

  // If onboarding is already completed, redirect to dashboard
  if (status?.onboarding_completed) {
    redirect('/dashboard');
  }

  const currentStep = status?.onboarding_step || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to RankedCEO CRM</h1>
          <p className="mt-2 text-gray-600">Let's get you set up in just a few steps</p>
        </div>

        <ProgressIndicator currentStep={currentStep} />

        <div className="mt-8 bg-white shadow rounded-lg p-8">
          {currentStep === 0 && <WelcomeStep />}
          {currentStep === 1 && <CompanyInfoStep accountInfo={accountInfo} />}
          {currentStep === 2 && <TeamSetupStep />}
          {currentStep === 3 && <PreferencesStep accountInfo={accountInfo} />}
          {currentStep === 4 && <CompleteStep />}
        </div>
      </div>
    </div>
  );
}
