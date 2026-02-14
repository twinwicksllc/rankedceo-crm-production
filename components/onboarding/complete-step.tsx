'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';

export function CompleteStep() {
  const router = useRouter();

  const handleComplete = async () => {
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
      });

      router.push('/dashboard');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  return (
    <div className="space-y-8 text-center">
      <div className="flex justify-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-gray-900">You're all set!</h2>
        <p className="mt-3 text-lg text-gray-600">
          Your workspace is ready. Let's start managing your customer relationships.
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">What's next?</h3>
        <div className="grid gap-4 md:grid-cols-2 text-left">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-2">📇 Add Your First Contact</h4>
            <p className="text-sm text-gray-600">
              Start building your customer database by adding contacts and companies
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-2">💼 Create Your First Deal</h4>
            <p className="text-sm text-gray-600">
              Track opportunities and move them through your sales pipeline
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-2">📊 Set Up Pipelines</h4>
            <p className="text-sm text-gray-600">
              Customize your sales stages to match your business process
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-2">📧 Configure Email</h4>
            <p className="text-sm text-gray-600">
              Set up email tracking and campaigns to engage with customers
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Button onClick={handleComplete} size="lg" className="w-full md:w-auto">
          Go to Dashboard
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <p className="text-sm text-gray-500">
          Need help? Check out our{' '}
          <a href="#" className="text-blue-600 hover:underline">
            documentation
          </a>{' '}
          or{' '}
          <a href="#" className="text-blue-600 hover:underline">
            contact support
          </a>
        </p>
      </div>
    </div>
  );
}
