'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface OnboardingStepProps {
  icon: React.ReactNode
  title: string
  description: string
  children?: React.ReactNode
  variant?: 'default' | 'compact'
}

/**
 * Reusable wrapper for onboarding wizard steps
 * Provides consistent styling and layout for multi-step flows
 */
export function OnboardingStep({
  icon,
  title,
  description,
  children,
  variant = 'default'
}: OnboardingStepProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-start w-full',
      variant === 'compact' ? 'gap-4' : 'gap-6'
    )}>
      {/* Icon */}
      <div className={cn(
        'inline-flex items-center justify-center rounded-2xl bg-primary/10',
        variant === 'compact' ? 'h-16 w-16' : 'h-24 w-24'
      )}>
        <div className={cn(
          'text-primary',
          variant === 'compact' ? 'w-8 h-8' : 'w-12 h-12'
        )}>
          {icon}
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-2 max-w-md">
        <h2 className={cn(
          'font-black text-foreground tracking-tight',
          variant === 'compact' ? 'text-xl' : 'text-2xl sm:text-3xl'
        )}>
          {title}
        </h2>
        <p className="text-muted-foreground font-medium leading-relaxed text-sm sm:text-base">
          {description}
        </p>
      </div>

      {/* Action slots */}
      {children && (
        <div className="w-full mt-4 sm:mt-6">
          {children}
        </div>
      )}
    </div>
  )
}
