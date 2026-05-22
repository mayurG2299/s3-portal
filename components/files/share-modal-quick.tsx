import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'

interface ShareModalQuickProps {
  fileName?: string
  fileCount: number
  onCreateLink: (options: QuickShareOptions) => Promise<void>
  onShowAdvanced: () => void
  onClose: () => void
  isCreating: boolean
}

export interface QuickShareOptions {
  mode: 'preview' | 'download' | 'direct'
  expiry: '3600' | '86400' | '604800' | '2592000'
}

export function ShareModalQuick({
  fileName,
  fileCount,
  onCreateLink,
  onShowAdvanced,
  onClose,
  isCreating
}: ShareModalQuickProps) {
  const [mode, setMode] = useState<'preview' | 'download' | 'direct'>('preview')
  const [expiry, setExpiry] = useState<'3600' | '86400' | '604800' | '2592000'>('86400')

  const handleCreate = async () => {
    await onCreateLink({ mode, expiry })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">
          {fileCount === 1 && fileName ? `Share ${fileName}` : `Share ${fileCount} Files`}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Create a shareable link with basic settings
        </p>
      </div>

      {/* Quick Options */}
      <div className="space-y-4">
        {/* Link Mode */}
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Link Type
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Preview Page', value: 'preview' as const },
              { label: 'Auto Download', value: 'download' as const },
              { label: 'Direct S3/CDN', value: 'direct' as const },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={mode === option.value ? 'default' : 'outline'}
                onClick={() => setMode(option.value)}
                className="h-auto py-2 whitespace-normal text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Expiry - Only 4 most common options */}
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Expires In
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '1 Hour', value: '3600' as const },
              { label: '1 Day', value: '86400' as const },
              { label: '1 Week', value: '604800' as const },
              { label: '30 Days', value: '2592000' as const },
            ].map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={expiry === option.value ? 'default' : 'outline'}
                onClick={() => setExpiry(option.value)}
                className="h-auto py-2 whitespace-normal text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="ghost"
          onClick={onShowAdvanced}
          className="text-sm"
          type="button"
        >
          <Settings className="h-4 w-4 mr-2" />
          More Options
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating}
            className="btn-primary-gradient"
            type="button"
          >
            {isCreating ? 'Creating...' : 'Create Link'}
          </Button>
        </div>
      </div>
    </div>
  )
}
