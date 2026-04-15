import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

const SECTIONS: ShortcutSection[] = [
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
      { label: 'Preview file', keys: ['Space', '⌘↓'] },
      { label: 'Delete', keys: ['Del'] },
    ],
  },
  {
    heading: 'Selection',
    rows: [
      { label: 'Select all', keys: ['⌘A'] },
      { label: 'Extend selection', keys: ['⇧↑', '⇧↓'] },
      { label: 'Clear focus / close', keys: ['Esc'] },
    ],
  },
]

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
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
