'use client'

import type { EmailFilters } from '@/lib/types/email'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, Filter } from 'lucide-react'

interface EmailFiltersProps {
  filters: EmailFilters
  onFiltersChange: (filters: EmailFilters) => void
}

export function EmailFilters({ filters, onFiltersChange }: EmailFiltersProps) {
  const updateFilter = (key: keyof EmailFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilter = (key: keyof EmailFilters) => {
    const newFilters = { ...filters }
    delete newFilters[key]
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  const activeFilterCount = Object.keys(filters).filter(
    key => filters[key as keyof EmailFilters] !== undefined && filters[key as keyof EmailFilters] !== ''
  ).length

  return (
    <div className="space-y-4 p-4 bg-card rounded-lg border">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
          >
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Filter Options */}
      <div className="flex flex-wrap gap-3">
        {/* Direction Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={filters.direction || ''}
            onValueChange={(value) => updateFilter('direction', value || undefined)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Directions</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <Select
          value={filters.status || ''}
          onValueChange={(value) => updateFilter('status', value || undefined)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Status</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {filters.direction && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Direction: {filters.direction}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter('direction')}
              />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Status: {filters.status}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => clearFilter('status')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}