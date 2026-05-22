import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MoreHorizontal, Eye, Share2, Database, Tag, Star, Trash2 } from 'lucide-react'

interface FileActionsMenuProps {
  file: {
    id: string
    name: string
    key: string
    contentType?: string
    isFavorite?: boolean
  }
  isFolder: boolean
  canPreview: boolean
  onPreview: () => void
  onShare: () => void
  onDirectLink: () => void
  onEditTags: () => void
  onToggleFavorite: () => void
  onDelete: () => void
}

export function FileActionsMenu({
  file,
  isFolder,
  canPreview,
  onPreview,
  onShare,
  onDirectLink,
  onEditTags,
  onToggleFavorite,
  onDelete,
}: FileActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleAction = (action: () => void) => {
    setIsOpen(false)
    action()
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">File actions for {file.name}</span>
      </Button>

      {isOpen && (
        <Card
          role="menu"
          aria-label="File actions"
          className="absolute right-0 top-full mt-1 w-56 p-1.5 z-50 border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur shadow-lg"
        >
          {/* VIEW Group */}
          {!isFolder && canPreview && (
            <>
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                View
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => handleAction(onPreview)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </>
          )}

          {/* SHARE Group */}
          {!isFolder && (
            <>
              <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                Share
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => handleAction(onShare)}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Create Share Link
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm"
                onClick={() => handleAction(onDirectLink)}
              >
                <Database className="mr-2 h-4 w-4" />
                Copy CDN URL
              </Button>
            </>
          )}

          {/* ORGANIZE Group */}
          <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
            Organize
          </div>
          {!isFolder && (
            <Button
              variant="ghost"
              className="w-full justify-start text-sm"
              onClick={() => handleAction(onToggleFavorite)}
            >
              <Star
                className={`mr-2 h-4 w-4 ${
                  file.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''
                }`}
              />
              {file.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={() => handleAction(onEditTags)}
          >
            <Tag className="mr-2 h-4 w-4" />
            Edit Tags & Description
          </Button>

          {/* DANGER Group */}
          <div className="h-px bg-border my-1" />
          <Button
            variant="ghost"
            className="w-full justify-start text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleAction(onDelete)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </Card>
      )}
    </div>
  )
}
