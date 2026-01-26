'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'

interface EmailTemplate {
  id?: string
  name: string
  subject: string
  description?: string
  html_content: string
  text_content?: string
  variables?: string[]
  is_default?: boolean
}

interface EmailTemplateFormProps {
  template?: EmailTemplate
  action: (formData: FormData) => Promise<void>
  submitLabel?: string
}

export function EmailTemplateForm({ template, action, submitLabel = 'Save Template' }: EmailTemplateFormProps) {
  const router = useRouter()
  const [variables, setVariables] = useState<string[]>(
    template?.variables || []
  )
  const [newVariable, setNewVariable] = useState('')

  const addVariable = () => {
    if (newVariable.trim() && !variables.includes(newVariable.trim())) {
      setVariables([...variables, newVariable.trim()])
      setNewVariable('')
    }
  }

  const removeVariable = (variable: string) => {
    setVariables(variables.filter(v => v !== variable))
  }

  async function handleSubmit(formData: FormData) {
    formData.append('variables', JSON.stringify(variables))
    await action(formData)
  }

  return (
    <form action={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Template name and subject line
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={template?.name}
                  placeholder="Welcome Email"
                  required
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  name="subject"
                  defaultValue={template?.subject}
                  placeholder="Welcome to our platform!"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={template?.description}
                  placeholder="Brief description of this template"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HTML Content</CardTitle>
              <CardDescription>
                Design your email using HTML. Use variables like {'{{name}}'} for personalization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="html_content"
                name="html_content"
                defaultValue={template?.html_content}
                placeholder="<html><body><h1>Hello {{name}}!</h1></body></html>"
                rows={15}
                required
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Text Content (Optional)</CardTitle>
              <CardDescription>
                Plain text version for email clients that don't support HTML
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                id="text_content"
                name="text_content"
                defaultValue={template?.text_content}
                placeholder="Plain text version of your email"
                rows={6}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Default Template</Label>
                  <p className="text-xs text-gray-500">
                    Set as default for new campaigns
                  </p>
                </div>
                <Switch
                  id="is_default"
                  name="is_default"
                  defaultChecked={template?.is_default}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variables</CardTitle>
              <CardDescription>
                Add personalization variables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newVariable}
                  onChange={(e) => setNewVariable(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addVariable())}
                  placeholder="Variable name"
                />
                <Button type="button" onClick={addVariable} size="sm">
                  Add
                </Button>
              </div>
              
              {variables.length > 0 ? (
                <div className="space-y-2">
                  {variables.map((variable, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <code className="text-sm">{`{{${variable}}}`}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariable(variable)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No variables added yet
                </p>
              )}
              
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVariables(['name', 'email', 'company'])}
                  className="w-full"
                >
                  Add Common Variables
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button type="submit" className="w-full">
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
