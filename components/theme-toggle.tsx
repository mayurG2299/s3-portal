"use client"

import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Moon, Sun } from "lucide-react"
import { THEMES, ThemeId, ThemeMode, getSavedTheme, getSavedMode, applyThemeAndMode } from "@/lib/theme-store"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const [open, setOpen] = useState(false)
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("nebula")
  const [selectedMode, setSelectedMode] = useState<ThemeMode>("dark")
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const theme = getSavedTheme()
    const mode = getSavedMode()
    setSelectedTheme(theme)
    setSelectedMode(mode)
    applyThemeAndMode(theme, mode)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleThemeSelect = useCallback((themeId: ThemeId) => {
    setSelectedTheme(themeId)
    applyThemeAndMode(themeId, selectedMode)
  }, [selectedMode])

  const handleModeSelect = useCallback((mode: ThemeMode) => {
    setSelectedMode(mode)
    applyThemeAndMode(selectedTheme, mode)
  }, [selectedTheme])

  const currentTheme = THEMES.find(t => t.id === selectedTheme)

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="h-9 w-9 rounded-full border border-border flex items-center justify-center overflow-hidden transition-all hover:scale-105 hover:border-brand/50 flex-shrink-0"
        style={{ width: 36, height: 36 }}
        aria-label="Theme & Appearance"
        title="Theme & Appearance"
      >
        <div className="h-full w-full relative">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${currentTheme?.darkAccent ?? '#8c2bee'} 50%, ${currentTheme?.lightAccent ?? '#7c22d4'} 50%)`
            }}
          />
        </div>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[300px] bg-popover border border-border rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2"
        >
          <div className="mb-3">
            <p className="text-sm font-semibold text-foreground">Appearance</p>
            <p className="text-xs text-muted-foreground">Theme & brightness</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-4">
            <button
              onClick={() => handleModeSelect("dark")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                selectedMode === "dark"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon size={14} />
              Dark
            </button>
            <button
              onClick={() => handleModeSelect("light")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                selectedMode === "light"
                  ? "bg-brand text-brand-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun size={14} />
              Light
            </button>
          </div>

          {/* Theme grid */}
          <p className="text-xs text-muted-foreground mb-2">Color theme</p>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((theme) => {
              const isSelected = selectedTheme === theme.id
              const bg = selectedMode === "dark" ? theme.darkBg : theme.lightBg
              const accent = selectedMode === "dark" ? theme.darkAccent : theme.lightAccent
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeSelect(theme.id)}
                  className={cn(
                    "rounded-xl p-1.5 transition-all duration-200 cursor-pointer",
                    isSelected
                      ? "ring-2 ring-brand ring-offset-2 ring-offset-background scale-[1.04]"
                      : "border border-border hover:border-brand/50 hover:scale-[1.02]"
                  )}
                >
                  <div className="rounded-lg overflow-hidden mb-1.5">
                    <div className="h-8" style={{ backgroundColor: bg }} />
                    <div className="h-3" style={{ backgroundColor: accent }} />
                  </div>
                  <p className="text-[10px] font-medium text-center text-foreground truncate">{theme.label}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
