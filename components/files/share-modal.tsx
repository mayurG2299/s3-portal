import { useState } from 'react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { ShareModalQuick, QuickShareOptions } from './share-modal-quick'
import { ShareModalAdvanced, AdvancedShareOptions } from './share-modal-advanced'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareTargets: Array<{ id: string; name: string }>
  onCreateLink: (options: ShareLinkOptions) => Promise<void>
  isCreating: boolean
}

export interface ShareLinkOptions {
  mode: 'preview' | 'download' | 'direct'
  expiryMode: 'preset' | 'custom' | 'never'
  expiresIn?: string
  customExpiry?: string
  password?: string
  maxDownloads?: string
}

export function ShareModal({
  open,
  onOpenChange,
  shareTargets,
  onCreateLink,
  isCreating
}: ShareModalProps) {
  const [view, setView] = useState<'quick' | 'advanced'>('quick')

  const handleClose = () => {
    setView('quick')
    onOpenChange(false)
  }

  const handleQuickCreate = async (options: QuickShareOptions) => {
    await onCreateLink({
      mode: options.mode,
      expiryMode: 'preset',
      expiresIn: options.expiry,
    })
  }

  const handleAdvancedCreate = async (options: AdvancedShareOptions) => {
    await onCreateLink({
      mode: options.mode,
      expiryMode: options.expiryMode,
      expiresIn: options.expiresIn,
      customExpiry: options.customExpiry,
      password: options.password,
      maxDownloads: options.maxDownloads,
    })
  }

  const fileName = shareTargets.length === 1 ? shareTargets[0].name : undefined
  const fileCount = shareTargets.length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Show file list if multiple files */}
        {shareTargets.length > 1 && (
          <Card className="p-3 text-sm text-muted-foreground bg-muted/50 border-border mb-4">
            {shareTargets.slice(0, 3).map((file) => file.name).join(', ')}
            {shareTargets.length > 3 && ` +${shareTargets.length - 3} more`}
          </Card>
        )}

        {view === 'quick' ? (
          <ShareModalQuick
            fileName={fileName}
            fileCount={fileCount}
            onCreateLink={handleQuickCreate}
            onShowAdvanced={() => setView('advanced')}
            onClose={handleClose}
            isCreating={isCreating}
          />
        ) : (
          <ShareModalAdvanced
            fileName={fileName}
            fileCount={fileCount}
            onCreateLink={handleAdvancedCreate}
            onBack={() => setView('quick')}
            onClose={handleClose}
            isCreating={isCreating}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
