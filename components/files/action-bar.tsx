import { Button } from "@/components/ui/button"
import { Upload, Share2, Download, FolderPlus, RefreshCw, FolderDown } from "lucide-react"

interface ActionBarProps {
  selectedCount: number
  currentPath: string
  onUpload: () => void
  onShare: () => void
  onDownload: () => void
  onNewFolder: () => void
  onRefresh: () => void
  onDownloadFolder?: () => void
  disabled?: boolean
  isRefreshing?: boolean
  isDownloading?: boolean
}

export function FilesActionBar({
  selectedCount,
  currentPath,
  onUpload,
  onShare,
  onDownload,
  onNewFolder,
  onRefresh,
  onDownloadFolder,
  disabled = false,
  isRefreshing = false,
  isDownloading = false
}: ActionBarProps) {
  const isRootPath = currentPath === '/' || currentPath === ''

  return (
    <div className="flex items-center gap-2 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Primary Action - Always visible */}
      <Button
        onClick={onUpload}
        disabled={disabled}
        className="btn-primary-gradient"
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload
      </Button>

      {/* Divider */}
      <div className="h-6 w-px bg-border mx-2" />

      {/* Selection Actions - Only when files selected */}
      {selectedCount > 0 && (
        <>
          <Button
            onClick={onShare}
            variant="secondary"
            size="sm"
            disabled={disabled}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share ({selectedCount})
          </Button>
          <Button
            onClick={onDownload}
            variant="secondary"
            size="sm"
            disabled={disabled || isDownloading}
          >
            <Download className="h-4 w-4 mr-2" />
            Download ({selectedCount})
          </Button>
          <div className="h-6 w-px bg-border mx-2" />
        </>
      )}

      {/* Folder Actions */}
      <Button
        onClick={onNewFolder}
        variant="outline"
        size="sm"
        disabled={disabled}
      >
        <FolderPlus className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">New Folder</span>
      </Button>

      {!isRootPath && onDownloadFolder && (
        <Button
          onClick={onDownloadFolder}
          variant="outline"
          size="sm"
          disabled={disabled || isDownloading}
        >
          <FolderDown className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">
            {isDownloading ? 'Preparing...' : 'Download Folder'}
          </span>
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh - Always on right */}
      <Button
        onClick={onRefresh}
        variant="ghost"
        size="sm"
        disabled={disabled || isRefreshing}
      >
        <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        <span className="sr-only">Refresh</span>
      </Button>
    </div>
  )
}
