'use client'

import { createContext, useContext } from 'react'

interface ShortcutsModalContextValue {
  isShortcutsOpen: boolean
}

export const ShortcutsModalContext = createContext<ShortcutsModalContextValue>({
  isShortcutsOpen: false,
})

export function useShortcutsModal() {
  return useContext(ShortcutsModalContext)
}
