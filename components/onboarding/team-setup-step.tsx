'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { UserPlus, X } from 'lucide-react';

export function TeamSetupStep() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<string[]>(['']);

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validEmails = emails.filter(email => email.trim() !== '');
      
      if (validEmails.length > 0) {
        // TODO: Implement team invitation API
        await fetch('/api/onboarding/invite-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: validEmails }),
        });
      }

      // Move to next step
      await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 3 }),
      });

      window.location.reload();
    } catch (error) {
      console.error('Error inviting team:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 3 }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Error skipping step:', error);
    }
  };

  const handleBack = async () => {
    try {
      await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Error going back:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Invite your team</h2>
        <p className="mt-2 text-gray-600">
          Collaborate with your team members by inviting them to join your workspace
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Team members will receive an email invitation to join your workspace.
          You can always invite more people later from the settings page.
        </p>
      </div>

      <div className="space-y-4">
        <Label>Team Member Emails</Label>
        {emails.map((email, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => updateEmail(index, e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1"
            />
            {emails.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeEmailField(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          onClick={addEmailField}
          className="w-full"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Another Team Member
        </Button>
      </div>

      <div className="flex justify-between items-center pt-6 border-t">
        <Button type="button" variant="outline" onClick={handleBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Invitations'}
          </Button>
        </div>
      </div>
    </form>
  );
}
