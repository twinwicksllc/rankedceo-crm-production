'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronRight, ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react'

export interface AssessmentFormData {
  // Step 1: Patient Information
  patient_name: string
  patient_email: string
  patient_phone: string
  patient_dob: string

  // Step 2: Dental History
  dentist_name: string
  last_dental_visit: string
  dental_insurance: boolean
  insurance_provider: string

  // Step 3: Current Concerns
  current_concerns: string
  pain_sensitivity: string

  // Step 4: Smile Goals
  smile_goals: string[]
  desired_outcome: string

  // Step 5: Health History
  medical_conditions: string[]
  medications: string
  allergies: string
}

const initialFormData: AssessmentFormData = {
  patient_name: '',
  patient_email: '',
  patient_phone: '',
  patient_dob: '',
  dentist_name: '',
  last_dental_visit: '',
  dental_insurance: false,
  insurance_provider: '',
  current_concerns: '',
  pain_sensitivity: '',
  smile_goals: [],
  desired_outcome: '',
  medical_conditions: [],
  medications: '',
  allergies: '',
}

const smileGoalOptions = [
  'Whiter teeth',
  'Straighter teeth',
  'Fix gaps',
  'Repair damage',
  'Better bite',
  'More confidence',
]

const medicalConditionOptions = [
  'Heart disease',
  'Diabetes',
  'High blood pressure',
  'Bleeding disorders',
  'Osteoporosis',
  'None',
]

interface SmileAssessmentFormProps {
  onSubmit: (data: AssessmentFormData) => Promise<void>
  dentistId?: string
}

export function SmileAssessmentForm({ onSubmit, dentistId }: SmileAssessmentFormProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<AssessmentFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof AssessmentFormData, string>>>({})

  const totalSteps = 5

  const updateField = (field: keyof AssessmentFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const toggleArrayItem = (field: 'smile_goals' | 'medical_conditions', item: string) => {
    setFormData((prev) => {
      const currentArray = prev[field] as string[]
      const newArray = currentArray.includes(item)
        ? currentArray.filter((i) => i !== item)
        : [...currentArray, item]
      return { ...prev, [field]: newArray }
    })
  }

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Partial<Record<keyof AssessmentFormData, string>> = {}

    if (currentStep === 1) {
      if (!formData.patient_name.trim()) newErrors.patient_name = 'Name is required'
      if (!formData.patient_email.trim()) newErrors.patient_email = 'Email is required'
      if (formData.patient_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.patient_email)) {
        newErrors.patient_email = 'Invalid email format'
      }
      if (!formData.patient_phone.trim()) newErrors.patient_phone = 'Phone is required'
      if (!formData.patient_dob) newErrors.patient_dob = 'Date of birth is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const handlePrevious = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(step)) return

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error') // No PII logged
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-purple-200 shadow-lg">
      <CardHeader className="border-b border-purple-100 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl text-gray-900">Patient Assessment</CardTitle>
            <CardDescription className="text-gray-500">
              Step {step} of {totalSteps}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-all ${
                  index + 1 <= step ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Step 1: Patient Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="patient_name">Full Name *</Label>
                <Input
                  id="patient_name"
                  value={formData.patient_name}
                  onChange={(e) => updateField('patient_name', e.target.value)}
                  placeholder="John Doe"
                  className={errors.patient_name ? 'border-red-500' : ''}
                />
                {errors.patient_name && (
                  <p className="text-sm text-red-500">{errors.patient_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_email">Email Address *</Label>
                <Input
                  id="patient_email"
                  type="email"
                  value={formData.patient_email}
                  onChange={(e) => updateField('patient_email', e.target.value)}
                  placeholder="john@example.com"
                  className={errors.patient_email ? 'border-red-500' : ''}
                />
                {errors.patient_email && (
                  <p className="text-sm text-red-500">{errors.patient_email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_phone">Phone Number *</Label>
                <Input
                  id="patient_phone"
                  type="tel"
                  value={formData.patient_phone}
                  onChange={(e) => updateField('patient_phone', e.target.value)}
                  placeholder="(555) 123-4567"
                  className={errors.patient_phone ? 'border-red-500' : ''}
                />
                {errors.patient_phone && (
                  <p className="text-sm text-red-500">{errors.patient_phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_dob">Date of Birth *</Label>
                <Input
                  id="patient_dob"
                  type="date"
                  value={formData.patient_dob}
                  onChange={(e) => updateField('patient_dob', e.target.value)}
                  className={errors.patient_dob ? 'border-red-500' : ''}
                />
                {errors.patient_dob && (
                  <p className="text-sm text-red-500">{errors.patient_dob}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Dental History */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Dental History</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="dentist_name">Current Dentist Name</Label>
                <Input
                  id="dentist_name"
                  value={formData.dentist_name}
                  onChange={(e) => updateField('dentist_name', e.target.value)}
                  placeholder="Dr. Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_dental_visit">Last Dental Visit</Label>
                <Input
                  id="last_dental_visit"
                  value={formData.last_dental_visit}
                  onChange={(e) => updateField('last_dental_visit', e.target.value)}
                  placeholder="6 months ago"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dental_insurance"
                    checked={formData.dental_insurance}
                    onCheckedChange={(checked) =>
                      updateField('dental_insurance', checked === true)
                    }
                  />
                  <Label htmlFor="dental_insurance" className="cursor-pointer">
                    I have dental insurance
                  </Label>
                </div>
              </div>

              {formData.dental_insurance && (
                <div className="space-y-2">
                  <Label htmlFor="insurance_provider">Insurance Provider</Label>
                  <Input
                    id="insurance_provider"
                    value={formData.insurance_provider}
                    onChange={(e) => updateField('insurance_provider', e.target.value)}
                    placeholder="Blue Cross, Aetna, etc."
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Current Concerns */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Concerns</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_concerns">
                  What brings you in today? Describe any concerns about your smile.
                </Label>
                <Textarea
                  id="current_concerns"
                  value={formData.current_concerns}
                  onChange={(e) => updateField('current_concerns', e.target.value)}
                  placeholder="I'd like to improve the color and alignment of my teeth..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pain_sensitivity">
                  Do you experience any pain or sensitivity?
                </Label>
                <Textarea
                  id="pain_sensitivity"
                  value={formData.pain_sensitivity}
                  onChange={(e) => updateField('pain_sensitivity', e.target.value)}
                  placeholder="Describe any pain, sensitivity, or discomfort..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Smile Goals */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Smile Goals</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>What are your smile goals? (Select all that apply)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {smileGoalOptions.map((goal) => (
                    <div key={goal} className="flex items-center space-x-2">
                      <Checkbox
                        id={`goal-${goal}`}
                        checked={formData.smile_goals.includes(goal)}
                        onCheckedChange={() => toggleArrayItem('smile_goals', goal)}
                      />
                      <Label htmlFor={`goal-${goal}`} className="cursor-pointer font-normal">
                        {goal}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desired_outcome">
                  Describe your ideal smile outcome
                </Label>
                <Textarea
                  id="desired_outcome"
                  value={formData.desired_outcome}
                  onChange={(e) => updateField('desired_outcome', e.target.value)}
                  placeholder="I want a bright, natural-looking smile that boosts my confidence..."
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Health History */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Health History</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Do you have any of the following conditions?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {medicalConditionOptions.map((condition) => (
                    <div key={condition} className="flex items-center space-x-2">
                      <Checkbox
                        id={`condition-${condition}`}
                        checked={formData.medical_conditions.includes(condition)}
                        onCheckedChange={() => toggleArrayItem('medical_conditions', condition)}
                      />
                      <Label
                        htmlFor={`condition-${condition}`}
                        className="cursor-pointer font-normal"
                      >
                        {condition}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="medications">Current Medications</Label>
                <Textarea
                  id="medications"
                  value={formData.medications}
                  onChange={(e) => updateField('medications', e.target.value)}
                  placeholder="List any medications you're currently taking..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea
                  id="allergies"
                  value={formData.allergies}
                  onChange={(e) => updateField('allergies', e.target.value)}
                  placeholder="List any known allergies (medications, latex, etc.)..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={step === 1 || isSubmitting}
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Submit Assessment
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
