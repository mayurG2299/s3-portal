'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRBAC } from '@/components/rbac-provider'

interface KeyboardShortcutsModalProps {
  open: boolean
  onClose: () => void
}

interface ShortcutRow {
  label: string
  keys: string[]
}

interface ShortcutSection {
  heading: string
  rows: ShortcutRow[]
}

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  const { isAdmin } = useRBAC()

  const globalRows: ShortcutRow[] = [
    { label: 'Search', keys: ['⌘K'] },
    { label: 'Settings', keys: ['⌘,'] },
    { label: 'Dashboard', keys: ['⌘⇧1'] },
    { label: 'Files', keys: ['⌘⇧2'] },
    { label: 'Links', keys: ['⌘⇧3'] },
    { label: 'Invitations', keys: ['⌘⇧4'] },
    { label: 'Teams', keys: ['⌘⇧5'] },
    { label: 'Settings', keys: ['⌘⇧6'] },
    ...(isAdmin ? [
      { label: 'Permissions (admin)', keys: ['⌘⇧7'] },
      { label: 'Audit Logs (admin)', keys: ['⌘⇧8'] },
    ] : []),
  ]

  const sections: ShortcutSection[] = [
    {
      heading: 'Global',
      rows: globalRows,
    },
    {
      heading: 'Navigation',
      rows: [
        { label: 'Move focus', keys: ['↑', '↓'] },
        { label: 'Open folder', keys: ['↵', '⌘↓'] },
        { label: 'Go up', keys: ['⌫', '⌘↑'] },
        { label: 'Jump to name', keys: ['A–Z'] },
      ],
    },
    {
      heading: 'File Actions',
      rows: [
        { label: 'Preview', keys: ['Space'] },
        { label: 'Favorite', keys: ['F'] },
        { label: 'Direct link', keys: ['⌘L'] },
        { label: 'Share', keys: ['⌘⇧S'] },
        { label: 'Delete', keys: ['Del'] },
        { label: 'Upload', keys: ['⌘U'] },
        { label: 'New folder', keys: ['⌘⇧F'] },
      ],
    },
    {
      heading: 'Selection',
      rows: [
        { label: 'Select all', keys: ['⌘A'] },
        { label: 'Extend selection', keys: ['⇧↑', '⇧↓'] },
        { label: 'Clear / close', keys: ['Esc'] },
      ],
    },
    {
      heading: 'Search Palette',
      rows: [
        { label: 'Open / close palette', keys: ['⌘K'] },
        { label: 'Navigate results', keys: ['↑', '↓'] },
        { label: 'Open file preview', keys: ['↵'] },
        { label: 'Full results page', keys: ['⌘↵'] },
        { label: 'Close palette', keys: ['Esc'] },
      ],
    },
    {
      heading: 'Links Page',
      rows: [
        { label: 'Copy URL', keys: ['C'] },
        { label: 'Delete link', keys: ['D'] },
      ],
    },
    {
      heading: 'Invitations Page',
      rows: [
        { label: 'Accept', keys: ['A'] },
        { label: 'Decline', keys: ['X'] },
      ],
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                {section.heading}
              </p>
              <div className="space-y-1">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <div className="flex gap-1">
                      {row.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
