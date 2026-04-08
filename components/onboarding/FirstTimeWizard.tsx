'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OnboardingStep } from './OnboardingStep'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { useTeamRemoved } from '@/lib/contexts/dashboard-context'
import { Zap, Database, Upload, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWindowSize } from '@/hooks/use-window-size'
import { useRBAC } from '@/components/rbac-provider'

interface FirstTimeWizardProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  currentCredentialsCount?: number
}

type WizardStep = 'welcome' | 'credentials' | 'upload'

/**
 * First-time user onboarding wizard
 * Guides new users through: Welcome → Add AWS Credentials → Upload Preview
 * 
 * Features:
 * - 3-step flow (can skip at any time)
 * - Mobile-responsive (full-screen bottom sheet on mobile, centered modal on desktop)
 * - Marks completion in localStorage + sends to backend for persistence
 * - Can be reopened anytime via help menu
 */
export function FirstTimeWizard({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  currentCredentialsCount = 0
}: FirstTimeWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome')
  const [isLoading, setIsLoading] = useState(false)
  const [credentialName, setCredentialName] = useState('')
  const [credentialKey, setCredentialKey] = useState('')
  const [credentialSecret, setCredentialSecret] = useState('')
  const [region, setRegion] = useState('')
  const [bucketName, setBucketName] = useState('')
  const [internalOpen, setInternalOpen] = useState(false)
  const isMobile = useWindowSize().width < 768
  const rbac = useRBAC()

  // Check if user can create credentials
  const { teamRemoved } = useTeamRemoved();
  const canCreateCredentials = rbac.canEditScreen('CREDENTIALS_CREATE')

  // Use controlled open state if provided, otherwise use internal state
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = controlledOnOpenChange || setInternalOpen

  // Re-open onboarding on dashboard visits until at least one credential exists.
  // This intentionally ignores localStorage completion so users are repeatedly prompted
  // to add credentials when setup is still incomplete.
  const trimmedName = credentialName.trim()
  const trimmedAccessKey = credentialKey.trim()
  const trimmedSecretKey = credentialSecret.trim()
  const trimmedRegion = region.trim()
  const trimmedBucketName = bucketName.trim()
  const isCredentialsFormValid =
    trimmedName.length > 0 &&
    trimmedAccessKey.length > 0 &&
    trimmedSecretKey.length > 0 &&
    trimmedRegion.length > 0 &&
    trimmedBucketName.length > 0

  useEffect(() => {
    if (currentCredentialsCount === 0) {
      setInternalOpen(true)
      setCurrentStep('welcome')
    }
  }, [currentCredentialsCount])

  const handleSkip = () => {
    setOpen(false)
  }

  const handleNext = () => {
    if (currentStep === 'welcome') {
      // Skip credentials step if user cannot create credentials
      if (!canCreateCredentials) {
        setCurrentStep('upload')
      } else {
        setCurrentStep('credentials')
      }
    } else if (currentStep === 'credentials') {
      setCurrentStep('upload')
    }
  }

  const handlePrevious = () => {
    if (currentStep === 'credentials') {
      setCurrentStep('welcome')
    } else if (currentStep === 'upload') {
      // Go back to welcome if user can't create credentials, otherwise to credentials
      setCurrentStep(canCreateCredentials ? 'credentials' : 'welcome')
    }
  }

  const handleAddCredentials = async () => {
    if (!isCredentialsFormValid) {
      if (!teamRemoved) {
        toast({
          variant: 'destructive',
          title: 'Missing Information',
          description: 'Please fill in all fields'
        })
      }
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          accessKey: trimmedAccessKey,
          secretKey: trimmedSecretKey,
          region: trimmedRegion,
          buckets: [
            { bucket: trimmedBucketName }
          ]
        })
      })

      const data = await response.json()
      if (!response.ok) {
        const msg = data?.error || data?.message || 'Failed to save credentials'
        if (!teamRemoved) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: msg
          })
        }
        return
      }

      if (!teamRemoved) {
        toast({
          title: 'Success!',
          description: 'AWS credentials added. Continue to complete setup.'
        })
      }

      handleNext()
    } catch (error: unknown) {
      if (!teamRemoved) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: (error instanceof Error ? error.message : 'Failed to add credentials. Please try again.')
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = () => {
    localStorage.setItem('s3-portal-onboarding-completed', 'true')
    setOpen(false)
    toast({
      title: 'Welcome!',
      description: 'You\'re all set. Start uploading files now!'
    })
  }

  // Calculate step progress (adjust for skipped credentials step)
  const totalSteps = canCreateCredentials ? 3 : 2
  const stepIndex = canCreateCredentials
    ? { welcome: 0, credentials: 1, upload: 2 }[currentStep]
    : { welcome: 0, upload: 1, credentials: 1 }[currentStep] // credentials should never be active
  const progress = ((stepIndex + 1) / totalSteps) * 100

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className={cn(
        'gap-8 p-6 sm:p-8 max-h-screen overflow-y-auto',
        isMobile
          ? 'w-[95vw] max-w-none rounded-t-2xl rounded-b-none'
          : 'sm:max-w-2xl rounded-2xl'
      )} hideClose>
        <DialogTitle className="sr-only">First-time onboarding wizard</DialogTitle>
        <DialogDescription className="sr-only">
          Complete setup steps to connect AWS credentials and start uploading files.
        </DialogDescription>
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center pr-12">
            <div className="flex gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 rounded-full transition-all',
                    i < stepIndex + 1 ? 'bg-primary w-6' : 'bg-muted w-4'
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {stepIndex + 1} of {totalSteps}
            </span>
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-[300px] sm:min-h-[400px] flex flex-col justify-between">
          {currentStep === 'welcome' && (
            <OnboardingStep
              icon={<Zap className="w-full h-full" />}
              title="Welcome to S3 Portal!"
              description="Let's connect your AWS storage in just a few steps. You'll be uploading files in minutes."
            >
              <div className="space-y-3 w-full">
                <Button
                  onClick={handleNext}
                  className="w-full h-11 font-bold text-base"
                  size="lg"
                >
                  Get Started <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="ghost"
                  className="w-full"
                >
                  Skip for Now
                </Button>
              </div>
            </OnboardingStep>
          )}

          {currentStep === 'credentials' && (
            <OnboardingStep
              icon={<Database className="w-full h-full" />}
              title="Connect Your AWS Storage"
              description="Add your AWS credentials to access your S3 buckets. You can do this later in Settings."
            >
              <div className="space-y-4 w-full">
                <div>
                  <Label htmlFor="cred-name" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Credential Name
                  </Label>
                  <Input
                    id="cred-name"
                    placeholder="e.g., My AWS Account"
                    value={credentialName}
                    onChange={(e) => setCredentialName(e.target.value)}
                    className="mt-2 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="access-key" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    AWS Access Key
                  </Label>
                  <Input
                    id="access-key"
                    type="password"
                    placeholder="AKIA..."
                    value={credentialKey}
                    onChange={(e) => setCredentialKey(e.target.value)}
                    className="mt-2 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="secret-key" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    AWS Secret Key
                  </Label>
                  <Input
                    id="secret-key"
                    type="password"
                    placeholder="••••••••••••••••••••"
                    value={credentialSecret}
                    onChange={(e) => setCredentialSecret(e.target.value)}
                    className="mt-2 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="region" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    AWS Region
                  </Label>
                  <Input
                    id="region"
                    placeholder="us-east-1"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="mt-2 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="bucket-name" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    S3 Bucket Name
                  </Label>
                  <Input
                    id="bucket-name"
                    placeholder="my-bucket-name"
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    className="mt-2 h-10"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Need help?{' '}
                  <a href="/documentation/aws-setup" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    View setup guide
                  </a>
                </p>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handlePrevious}
                    variant="ghost"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button
                    onClick={handleAddCredentials}
                    className="flex-1 font-bold"
                    disabled={isLoading || !isCredentialsFormValid}
                  >
                    {isLoading ? 'Adding...' : 'Next'} <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </OnboardingStep>
          )}

          {currentStep === 'upload' && (
            <OnboardingStep
              icon={<Upload className="w-full h-full" />}
              title="You're All Set!"
              description="Your AWS account is connected. Now you can go to Files and start uploading documents, images, and more."
            >
              <div className="space-y-3 w-full">
                <Button
                  onClick={handleComplete}
                  className="w-full h-11 font-bold text-base"
                  size="lg"
                >
                  Go to Files <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="ghost"
                  className="w-full"
                >
                  Skip for Now
                </Button>
              </div>
            </OnboardingStep>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
