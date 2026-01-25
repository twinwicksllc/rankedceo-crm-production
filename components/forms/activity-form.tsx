'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ActivityType, ActivityStatus, CreateActivityInput } from '@/lib/types/activity';

interface ActivityFormProps {
  initialData?: Partial<CreateActivityInput>;
  onSuccess?: () => void;
  onCancel?: () => void;
  contactId?: string;
  companyId?: string;
  dealId?: string;
}

const activityTypes: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'call', label: 'Phone Call', icon: '📞' },
  { value: 'meeting', label: 'Meeting', icon: '📅' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'note', label: 'Note', icon: '📝' },
  { value: 'task', label: 'Task', icon: '✅' },
];

const activityStatuses: { value: ActivityStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ActivityForm({
  initialData,
  onSuccess,
  onCancel,
  contactId,
  companyId,
  dealId,
}: ActivityFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateActivityInput>({
    type: initialData?.type || 'note',
    title: initialData?.title || '',
    description: initialData?.description || '',
    contact_id: contactId || initialData?.contact_id,
    company_id: companyId || initialData?.company_id,
    deal_id: dealId || initialData?.deal_id,
    status: initialData?.status || 'completed',
    due_date: initialData?.due_date || '',
    duration_minutes: initialData?.duration_minutes,
    location: initialData?.location || '',
    attendees: initialData?.attendees || [],
  });

  const [attendeeInput, setAttendeeInput] = useState('');

  const handleChange = (field: keyof CreateActivityInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddAttendee = () => {
    if (attendeeInput && !formData.attendees?.includes(attendeeInput)) {
      handleChange('attendees', [...(formData.attendees || []), attendeeInput]);
      setAttendeeInput('');
    }
  };

  const handleRemoveAttendee = (email: string) => {
    handleChange('attendees', formData.attendees?.filter(a => a !== email) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create activity');
      }
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.back();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create activity');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        )}

        {/* Activity Type */}
        <div>
          <Label htmlFor="type">Activity Type *</Label>
          <select
            id="type"
            value={formData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
          >
            {activityTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Enter activity title"
            required
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Enter activity description"
            rows={4}
            maxLength={2000}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Related Entities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {contactId && (
            <div>
              <Label>Contact</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600">
                Linked to contact
              </div>
            </div>
          )}
          {companyId && (
            <div>
              <Label>Company</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600">
                Linked to company
              </div>
            </div>
          )}
          {dealId && (
            <div>
              <Label>Deal</Label>
              <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600">
                Linked to deal
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {activityStatuses.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Conditional Fields */}
        {(formData.type === 'call' || formData.type === 'meeting' || formData.type === 'task') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date || ''}
                onChange={(e) => handleChange('due_date', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="1440"
                value={formData.duration_minutes || ''}
                onChange={(e) => handleChange('duration_minutes', parseInt(e.target.value) || undefined)}
              />
            </div>
          </div>
        )}

        {formData.type === 'meeting' && (
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              type="text"
              value={formData.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Enter meeting location"
              maxLength={200}
            />
          </div>
        )}

        {/* Attendees */}
        <div>
          <Label htmlFor="attendees">Attendees</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="attendees"
              type="email"
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              placeholder="Add attendee email"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAttendee())}
            />
            <Button type="button" onClick={handleAddAttendee}>
              Add
            </Button>
          </div>
          {formData.attendees && formData.attendees.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {formData.attendees.map((attendee, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {attendee}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttendee(attendee)}
                    className="hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Activity'}
          </Button>
        </div>
      </form>
    </Card>
  );
}