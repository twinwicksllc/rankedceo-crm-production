'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export function NotificationSettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({
    email_notifications: true,
    deal_updates: true,
    activity_reminders: true,
    weekly_summary: false,
    marketing_emails: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage('Notification settings updated successfully');
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to update settings');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Manage how you receive notifications</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email_notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email notifications for important updates
                </p>
              </div>
              <Switch
                id="email_notifications"
                checked={settings.email_notifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, email_notifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="deal_updates">Deal Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when deals change status
                </p>
              </div>
              <Switch
                id="deal_updates"
                checked={settings.deal_updates}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, deal_updates: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="activity_reminders">Activity Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Receive reminders for upcoming activities
                </p>
              </div>
              <Switch
                id="activity_reminders"
                checked={settings.activity_reminders}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, activity_reminders: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="weekly_summary">Weekly Summary</Label>
                <p className="text-sm text-muted-foreground">
                  Get a weekly summary of your activities
                </p>
              </div>
              <Switch
                id="weekly_summary"
                checked={settings.weekly_summary}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, weekly_summary: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="marketing_emails">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates about new features and tips
                </p>
              </div>
              <Switch
                id="marketing_emails"
                checked={settings.marketing_emails}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, marketing_emails: checked })
                }
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('success') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
