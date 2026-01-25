'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function ActivityFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    router.push(`?${params.toString()}`);
  };

  const handleTypeFilter = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (type === 'all') {
      params.delete('type');
    } else {
      params.set('type', type);
    }
    router.push(`?${params.toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    router.push(`?${params.toString()}`);
  };

  const activeType = searchParams.get('type') || 'all';
  const activeStatus = searchParams.get('status') || 'all';

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            placeholder="Search activities..."
            defaultValue={searchParams.get('search') || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Type Filter */}
        <div className="flex gap-2">
          <Button
            variant={activeType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter('all')}
          >
            All Types
          </Button>
          <Button
            variant={activeType === 'call' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter('call')}
          >
            📞 Calls
          </Button>
          <Button
            variant={activeType === 'meeting' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter('meeting')}
          >
            📅 Meetings
          </Button>
          <Button
            variant={activeType === 'email' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter('email')}
          >
            📧 Emails
          </Button>
          <Button
            variant={activeType === 'note' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter('note')}
          >
            📝 Notes
          </Button>
          <Button
            variant={activeType === 'task' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTypeFilter('task')}
          >
            ✅ Tasks
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          <Button
            variant={activeStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusFilter('all')}
          >
            All Status
          </Button>
          <Button
            variant={activeStatus === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={activeStatus === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusFilter('completed')}
          >
            Completed
          </Button>
        </div>
      </div>
    </Card>
  );
}