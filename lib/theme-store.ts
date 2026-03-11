'use client'

export const THEMES = [
  {
    id: 'nebula',
    label: 'Nebula',
    description: 'Default purple',
    darkAccent:  '#8c2bee',
    lightAccent: '#7c22d4',
    darkBg:      '#0a0a0a',
    lightBg:     '#f5f3ff',
    hasLight: true,
  },
  {
    id: 'catppuccin',
    label: 'Catppuccin',
    description: 'Soothing pastels',
    darkAccent:  '#cba6f7',
    lightAccent: '#8839ef',
    darkBg:      '#1e1e2e',
    lightBg:     '#eff1f5',
    hasLight: true,
  },
  {
    id: 'tokyonight',
    label: 'Tokyo Night',
    description: 'Neon city vibes',
    darkAccent:  '#bb9af7',
    lightAccent: '#7847bd',
    darkBg:      '#1a1b26',
    lightBg:     '#e1e2e7',
    hasLight: true,
  },
  {
    id: 'dracula',
    label: 'Dracula',
    description: 'Bold & iconic',
    darkAccent:  '#bd93f9',
    lightAccent: '#7b3fca',
    darkBg:      '#282a36',
    lightBg:     '#f8f8f2',
    hasLight: true,
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Arctic & minimal',
    darkAccent:  '#88c0d0',
    lightAccent: '#5e81ac',
    darkBg:      '#2e3440',
    lightBg:     '#eceff4',
    hasLight: true,
  },
  {
    id: 'rosepine',
    label: 'Rosé Pine',
    description: 'Warm & earthy',
    darkAccent:  '#c4a7e7',
    lightAccent: '#907aa9',
    darkBg:      '#191724',
    lightBg:     '#faf4ed',
    hasLight: true,
  },
] as const

export type ThemeId = typeof THEMES[number]['id']
export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 's3portal-theme'
const MODE_KEY  = 's3portal-mode'
const DEFAULT_THEME: ThemeId = 'nebula'
const DEFAULT_MODE: ThemeMode = 'dark'

export function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const saved = localStorage.getItem(THEME_KEY)
  if (saved && THEMES.find(t => t.id === saved)) return saved as ThemeId
  return DEFAULT_THEME
}

export function getSavedMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  return (localStorage.getItem(MODE_KEY) as ThemeMode) ?? DEFAULT_MODE
}

export function applyThemeAndMode(themeId: ThemeId, mode: ThemeMode): void {
  const html = document.documentElement
  html.setAttribute('data-theme', themeId)
  html.classList.remove('dark', 'light')
  html.classList.add(mode)
  localStorage.setItem(THEME_KEY, themeId)
  localStorage.setItem(MODE_KEY, mode)
}
