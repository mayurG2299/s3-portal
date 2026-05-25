import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronLeft } from 'lucide-react'

interface ShareModalAdvancedProps {
  fileName?: string
  fileCount: number
  onCreateLink: (options: AdvancedShareOptions) => Promise<void>
  onBack: () => void
  onClose: () => void
  isCreating: boolean
}

export interface AdvancedShareOptions {
  mode: 'preview' | 'download' | 'direct'
  expiryMode: 'preset' | 'custom' | 'never'
  expiresIn?: string
  customExpiry?: string
  password?: string
  maxDownloads?: string
}

export function ShareModalAdvanced({
  fileName,
  fileCount,
  onCreateLink,
  onBack,
  onClose,
  isCreating
}: ShareModalAdvancedProps) {
  const [mode, setMode] = useState<'preview' | 'download' | 'direct'>('preview')
  const [expiryMode, setExpiryMode] = useState<'preset' | 'custom' | 'never'>('preset')
  const [expiresIn, setExpiresIn] = useState('86400')
  const [customExpiry, setCustomExpiry] = useState('')
  const [password, setPassword] = useState('')
  const [maxDownloads, setMaxDownloads] = useState('')

  const handleCreate = async () => {
    await onCreateLink({
      mode,
      expiryMode,
      expiresIn: expiryMode === 'preset' ? expiresIn : undefined,
      customExpiry: expiryMode === 'custom' ? customExpiry : undefined,
      password: password || undefined,
      maxDownloads: maxDownloads || undefined
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Back button */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} type="button">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Advanced Share Settings</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customize security and access options
          </p>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="space-y-6">
        {/* Link Mode (same as quick) */}
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

        {/* Expiry Options */}
        <div className="space-y-3">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Expiration
          </Label>

          <div className="space-y-2">
            {/* Preset Options */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '1 Hour', value: '3600' },
                { label: '1 Day', value: '86400' },
                { label: '1 Week', value: '604800' },
                { label: '30 Days', value: '2592000' },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    expiryMode === 'preset' && expiresIn === option.value
                      ? 'default'
                      : 'outline'
                  }
                  onClick={() => {
                    setExpiryMode('preset')
                    setExpiresIn(option.value)
                  }}
                  className="h-auto py-2 whitespace-normal text-xs"
                >
                  {option.label}
                </Button>
              ))}
              <Button
                type="button"
                variant={expiryMode === 'custom' ? 'default' : 'outline'}
                onClick={() => setExpiryMode('custom')}
                className="h-auto py-2 whitespace-normal text-xs"
              >
                Custom
              </Button>
              <Button
                type="button"
                variant={expiryMode === 'never' ? 'default' : 'outline'}
                onClick={() => setExpiryMode('never')}
                className="h-auto py-2 whitespace-normal text-xs"
              >
                Never
              </Button>
            </div>

            {/* Custom Date Picker */}
            {expiryMode === 'custom' && (
              <div className="mt-2">
                <label className="text-xs text-muted-foreground mb-1 block">
                  Pick expiry date and time
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Security Options - Only for non-direct links */}
        {mode !== 'direct' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="adv-share-password">Password (optional)</Label>
              <Input
                id="adv-share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set a password for this link"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adv-share-max-downloads">Download Limit (optional)</Label>
              <Input
                id="adv-share-max-downloads"
                type="number"
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                placeholder="Max downloads allowed"
                autoComplete="off"
              />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
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
  )
}
