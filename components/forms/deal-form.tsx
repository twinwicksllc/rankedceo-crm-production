'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'

interface DealFormProps {
  accountId: string
  contacts: Array<{ id: string; first_name: string; last_name: string }>
  companies: Array<{ id: string; name: string }>
  pipelines: Array<{ id: string; name: string }>
  deal?: {
    id: string
    name: string
    contact_id?: string
    company_id?: string
    pipeline_id?: string
    stage: string
    value?: number
    probability?: number
    expected_close_date?: string
    description?: string
  }
}

export default function DealForm({ accountId, contacts, companies, pipelines, deal }: DealFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: deal?.name || '',
    contact_id: deal?.contact_id || '',
    company_id: deal?.company_id || '',
    pipeline_id: deal?.pipeline_id || (pipelines[0]?.id || ''),
    stage: deal?.stage || 'lead',
    value: deal?.value?.toString() || '',
    probability: deal?.probability?.toString() || '50',
    expected_close_date: deal?.expected_close_date || '',
    description: deal?.description || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const dealData = {
        name: formData.name,
        contact_id: formData.contact_id || null,
        company_id: formData.company_id || null,
        pipeline_id: formData.pipeline_id || null,
        stage: formData.stage,
        value: formData.value ? parseFloat(formData.value) : null,
        probability: formData.probability ? parseInt(formData.probability) : null,
        expected_close_date: formData.expected_close_date || null,
        description: formData.description || null,
      }

      if (deal?.id) {
        // Update existing deal
        const { error: updateError } = await supabase
          .from('deals')
          .update({
            ...dealData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deal.id)

        if (updateError) throw updateError

        router.push(`/deals/${deal.id}`)
      } else {
        // Create new deal
        const { data, error: insertError } = await supabase
          .from('deals')
          .insert({
            ...dealData,
            account_id: accountId,
          })
          .select()
          .single()

        if (insertError) throw insertError

        router.push(`/deals/${data.id}`)
      }
      
      router.refresh()
    } catch (err: any) {
      console.error('Error saving deal:', err)
      setError(err.message || 'Failed to save deal')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Deal Information</h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Deal Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Q1 Enterprise License"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Deal Value ($)</Label>
            <Input
              id="value"
              name="value"
              type="number"
              step="0.01"
              value={formData.value}
              onChange={handleChange}
              placeholder="50000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_id">Contact</Label>
            <select
              id="contact_id"
              name="contact_id"
              value={formData.contact_id}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_id">Company</Label>
            <select
              id="company_id"
              name="company_id"
              value={formData.company_id}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline_id">Pipeline</Label>
            <select
              id="pipeline_id"
              name="pipeline_id"
              value={formData.pipeline_id}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select pipeline</option>
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Stage *</Label>
            <select
              id="stage"
              name="stage"
              value={formData.stage}
              onChange={handleChange}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="lead">Lead</option>
              <option value="qualified">Qualified</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="probability">Probability (%)</Label>
            <Input
              id="probability"
              name="probability"
              type="number"
              min="0"
              max="100"
              value={formData.probability}
              onChange={handleChange}
              placeholder="50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_close_date">Expected Close Date</Label>
            <Input
              id="expected_close_date"
              name="expected_close_date"
              type="date"
              value={formData.expected_close_date}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Additional details about this deal..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : deal ? 'Update Deal' : 'Create Deal'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
