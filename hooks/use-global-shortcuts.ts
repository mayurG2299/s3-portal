'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UseGlobalShortcutsOptions {
  onOpenSearch: () => void
  onOpenShortcuts: () => void
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable
}

const PAGE_MAP: Record<string, string> = {
  '1': '/dashboard',
  '2': '/dashboard/files',
  '3': '/dashboard/links',
  '4': '/dashboard/invitations',
  '5': '/dashboard/teams',
  '6': '/dashboard/settings',
  '7': '/dashboard/admin/permissions',
  '8': '/dashboard/admin/audit',
}

export function useGlobalShortcuts({ onOpenSearch, onOpenShortcuts }: UseGlobalShortcutsOptions) {
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K is handled by AiSearchPalette — skip here to avoid double-firing
      if (e.key === 'k' && e.metaKey && !e.shiftKey && !e.repeat) {
        return
      }

      // All other shortcuts blocked when typing
      if (isEditableElement(document.activeElement)) return

      // ? — open shortcuts modal
      if (e.key === '?' && !e.repeat) {
        e.preventDefault()
        onOpenShortcuts()
        return
      }

      // Cmd+, — settings
      if (e.key === ',' && e.metaKey && !e.repeat) {
        e.preventDefault()
        router.push('/dashboard/settings')
        return
      }

      // Cmd+Shift+Number — page navigation
      if (e.metaKey && e.shiftKey && !e.repeat && PAGE_MAP[e.key]) {
        e.preventDefault()
        router.push(PAGE_MAP[e.key])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenSearch, onOpenShortcuts, router])
}
