import { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Upload, Share2, Download, FolderPlus, RefreshCw } from "lucide-react"

interface MobileFABProps {
  selectedCount: number
  onUpload: () => void
  onShare: () => void
  onDownload: () => void
  onNewFolder: () => void
  onRefresh: () => void
  disabled?: boolean
  isRefreshing?: boolean
  isDownloading?: boolean
}

export function MobileFilesFAB({
  selectedCount,
  onUpload,
  onShare,
  onDownload,
  onNewFolder,
  onRefresh,
  disabled = false,
  isRefreshing = false,
  isDownloading = false
}: MobileFABProps) {
  const [open, setOpen] = useState(false)

  const closeAndExecute = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:hidden btn-primary-gradient z-40"
        size="icon"
        disabled={disabled}
      >
        <Plus className="h-6 w-6" />
        <span className="sr-only">Open file actions</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File Actions</DialogTitle>
            <DialogDescription>
              {selectedCount > 0
                ? `${selectedCount} file${selectedCount > 1 ? 's' : ''} selected`
                : 'Choose an action'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Button
              onClick={() => closeAndExecute(onUpload)}
              className="w-full justify-start btn-primary-gradient"
              disabled={disabled}
            >
              <Upload className="h-5 w-5 mr-3" />
              Upload Files
            </Button>

            {selectedCount > 0 && (
              <>
                <Button
                  onClick={() => closeAndExecute(onShare)}
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={disabled}
                >
                  <Share2 className="h-5 w-5 mr-3" />
                  Share Selected ({selectedCount})
                </Button>
                <Button
                  onClick={() => closeAndExecute(onDownload)}
                  variant="secondary"
                  className="w-full justify-start"
                  disabled={disabled || isDownloading}
                >
                  <Download className="h-5 w-5 mr-3" />
                  Download Selected ({selectedCount})
                </Button>
              </>
            )}

            <Button
              onClick={() => closeAndExecute(onNewFolder)}
              variant="outline"
              className="w-full justify-start"
              disabled={disabled}
            >
              <FolderPlus className="h-5 w-5 mr-3" />
              New Folder
            </Button>

            <Button
              onClick={() => closeAndExecute(onRefresh)}
              variant="ghost"
              className="w-full justify-start"
              disabled={disabled || isRefreshing}
            >
              <RefreshCw className={isRefreshing ? 'h-5 w-5 mr-3 animate-spin' : 'h-5 w-5 mr-3'} />
              Refresh
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
