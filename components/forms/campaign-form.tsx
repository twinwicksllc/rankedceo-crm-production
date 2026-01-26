'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignService } from '@/lib/services/campaign-service';
import { createCampaignSchema, type CampaignType } from '@/lib/validations/campaign';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function CampaignForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'one-time' as CampaignType,
    subject: '',
    body: '',
    from_email: '',
    from_name: '',
    scheduled_at: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate form data
      const validatedData = createCampaignSchema.parse({
        ...formData,
        target_contacts: [],
        target_companies: [],
        target_deals: [],
        segments: [],
        is_ab_test: false,
        ab_test_variants: [],
      });

      // Create campaign via API
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      const { campaign } = await response.json();

      toast({
        title: 'Success',
        description: 'Campaign created successfully',
      });

      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to create campaign. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Campaign Name *</Label>
          <Input
            id="name"
            placeholder="Welcome email series"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe your campaign..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="type">Campaign Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => handleChange('type', value)}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time">One-time Email</SelectItem>
              <SelectItem value="drip">Drip Campaign</SelectItem>
              <SelectItem value="automation">Automation</SelectItem>
              <SelectItem value="ab_test">A/B Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Content</CardTitle>
          <CardDescription>
            Configure your email content and sender details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject Line *</Label>
            <Input
              id="subject"
              placeholder="Welcome to our service!"
              value={formData.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="body">Email Body *</Label>
            <Textarea
              id="body"
              placeholder="Your email content here..."
              value={formData.body}
              onChange={(e) => handleChange('body', e.target.value)}
              rows={10}
              required
            />
            <p className="text-sm text-muted-foreground">
              Use {"{{variable_name}}"} for personalization (e.g., {"{{first_name}}"})
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="from_email">From Email</Label>
            <Input
              id="from_email"
              type="email"
              placeholder="noreply@rankedceo.com"
              value={formData.from_email}
              onChange={(e) => handleChange('from_email', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="from_name">From Name</Label>
            <Input
              id="from_name"
              placeholder="RankedCEO"
              value={formData.from_name}
              onChange={(e) => handleChange('from_name', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>
            Optionally schedule your campaign to send later
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="scheduled_at">Schedule Send (Optional)</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) => handleChange('scheduled_at', e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to send immediately
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? 'Creating...' : 'Create Campaign'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <a href="/campaigns">Cancel</a>
        </Button>
      </div>
    </form>
  );
}
