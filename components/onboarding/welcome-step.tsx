'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Rocket, Users, BarChart3, Zap } from 'lucide-react';

export function WelcomeStep() {
  const router = useRouter();

  const handleNext = async () => {
    try {
      const response = await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleSkip = async () => {
    try {
      const response = await fetch('/api/onboarding/skip', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Rocket className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome to RankedCEO CRM!</h2>
        <p className="mt-2 text-gray-600">
          Your all-in-one solution for managing customer relationships and growing your business
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <Users className="h-8 w-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Manage Contacts</h3>
          <p className="text-sm text-gray-600">
            Keep track of all your contacts, companies, and deals in one place
          </p>
        </div>

        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Track Performance</h3>
          <p className="text-sm text-gray-600">
            Monitor your sales pipeline and team performance with detailed analytics
          </p>
        </div>

        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <Zap className="h-8 w-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Automate Workflows</h3>
          <p className="text-sm text-gray-600">
            Save time with automated campaigns, email tracking, and commission calculations
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">What to expect:</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span>Set up your company information</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span>Invite your team members</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span>Customize your preferences</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">✓</span>
            <span>Start managing your customer relationships</span>
          </li>
        </ul>
      </div>

      <div className="flex justify-between items-center pt-6 border-t">
        <Button variant="ghost" onClick={handleSkip}>
          Skip for now
        </Button>
        <Button onClick={handleNext}>
          Get Started
        </Button>
      </div>
    </div>
  );
}
