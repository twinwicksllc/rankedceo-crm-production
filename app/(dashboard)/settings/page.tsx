import { createClient } from '@/lib/supabase/server';
import { SettingsService } from '@/lib/services/settings-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { AccountSettings } from '@/components/settings/account-settings';
import { TeamSettings } from '@/components/settings/team-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { SecuritySettings } from '@/components/settings/security-settings';
import { redirect } from 'next/navigation';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const settingsService = new SettingsService();
  
  let profile: any = null;
  let accountSettings: any = null;
  let teamMembers: any[] = [];
  
  try {
    [profile, accountSettings, teamMembers] = await Promise.all([
      settingsService.getUserProfile(),
      settingsService.getAccountSettings(),
      settingsService.getTeamMembers(),
    ]);
  } catch (error) {
    console.error('Error fetching settings:', error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <ProfileSettings profile={profile} />
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <AccountSettings account={accountSettings} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <TeamSettings teamMembers={teamMembers} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecuritySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
