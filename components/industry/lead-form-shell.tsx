"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Flame,
  Wrench,
  Lightbulb,
} from "lucide-react";
import type { IndustryType, IndustryConfig } from "@/lib/types/industry-lead";
import { INDUSTRY_CONFIGS } from "@/lib/types/industry-lead";

// ---------------------------------------------------------------------------
// Industry icon renderer
// ---------------------------------------------------------------------------

function IndustryIcon({
  industry,
  className,
}: {
  industry: IndustryType;
  className?: string;
}) {
  switch (industry) {
    case "hvac":
      return <Flame className={className} />;
    case "plumbing":
      return <Wrench className={className} />;
    case "electrical":
      return <Lightbulb className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeadFormShellProps {
  industry: IndustryType;
  totalSteps: number;
  currentStep: number;
  stepTitle: string;
  isSubmitting: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeadFormShell({
  industry,
  totalSteps,
  currentStep,
  stepTitle,
  isSubmitting,
  onNext,
  onPrevious,
  onSubmit,
  children,
}: LeadFormShellProps) {
  const config: IndustryConfig = INDUSTRY_CONFIGS[industry];
  const isLastStep = currentStep === totalSteps;

  // Derive Tailwind classes from config
  const borderColor = `border-${config.color.border}`;
  const bgLight = `bg-${config.color.light}`;
  const textPrimary = `text-${config.color.primary}`;
  const textColor = `text-${config.color.text}`;
  const progressFill = `bg-${config.color.primary}`;
  const btnOutline = `border-${config.color.border} text-${config.color.text} hover:bg-${config.color.light}`;

  return (
    <Card className={`${borderColor} shadow-lg`}>
      {/* Header */}
      <CardHeader
        className={`border-b ${borderColor} ${bgLight} bg-opacity-60`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${bgLight}`}>
              <IndustryIcon
                industry={industry}
                className={`h-5 w-5 ${textPrimary}`}
              />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-900">
                {stepTitle}
              </CardTitle>
              <CardDescription className="text-gray-500">
                Step {currentStep} of {totalSteps}
              </CardDescription>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-all duration-300 ${
                  index + 1 <= currentStep ? progressFill : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
      </CardHeader>

      {/* Form content */}
      <CardContent className="pt-6">
        {children}

        {/* Privacy note — standard (non-HIPAA) */}
        <p className="mt-4 text-xs text-gray-400">
          🔒 Your information is kept private and only shared with your service
          provider.
        </p>

        {/* Navigation buttons */}
        <div
          className={`mt-6 flex items-center justify-between border-t border-gray-200 pt-6`}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onPrevious}
            disabled={currentStep === 1 || isSubmitting}
            className={btnOutline}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {!isLastStep ? (
            <Button
              type="button"
              onClick={onNext}
              className={config.color.button}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className={config.color.button}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
