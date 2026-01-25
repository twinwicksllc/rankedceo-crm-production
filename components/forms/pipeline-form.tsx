'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'

interface PipelineFormProps {
  accountId: string
  pipeline?: {
    id: string
    name: string
    description?: string
  }
}

export default function PipelineForm({ accountId, pipeline }: PipelineFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: pipeline?.name || '',
    description: pipeline?.description || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (pipeline?.id) {
        // Update existing pipeline
        const { error: updateError } = await supabase
          .from('pipelines')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pipeline.id)

        if (updateError) throw updateError

        router.push(`/pipelines/${pipeline.id}`)
      } else {
        // Create new pipeline
        const { data, error: insertError } = await supabase
          .from('pipelines')
          .insert({
            ...formData,
            account_id: accountId,
          })
          .select()
          .single()

        if (insertError) throw insertError

        router.push('/pipelines')
      }
      
      router.refresh()
    } catch (err: any) {
      console.error('Error saving pipeline:', err)
      setError(err.message || 'Failed to save pipeline')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Pipeline Name *</Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Sales Pipeline"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Describe this pipeline..."
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : pipeline ? 'Update Pipeline' : 'Create Pipeline'}
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
