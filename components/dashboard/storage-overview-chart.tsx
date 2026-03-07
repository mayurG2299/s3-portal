'use client'

import { useState } from 'react'

interface StorageOverviewChartProps {
  monthlyDataGB: number[]
  yearlyDataGB: { year: number; gb: number }[]
}

export function StorageOverviewChart({ monthlyDataGB, yearlyDataGB }: StorageOverviewChartProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly')

  const activeData = viewMode === 'monthly' ? monthlyDataGB : yearlyDataGB.map(d => d.gb)
  const activeLabels = viewMode === 'monthly' 
    ? ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    : yearlyDataGB.map(d => d.year.toString())

  const maxGB = Math.max(...activeData, 1) // prevent divide by zero
  const getDynamicHeight = (gb: number) => {
    // scale max chart height to ~100px (smaller than before)
    const percentage = gb / maxGB
    return Math.max(10, Math.floor(percentage * 100))
  }

  return (
    <div className="glass-card flex flex-col justify-between h-full w-full min-h-[300px]">
      <div className="flex flex-wrap gap-4 items-center justify-between mb-8">
        <h4 className="text-sm font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#8c2bee] shadow-[0_0_10px_rgba(140,43,238,0.8)]" />
          Storage Overview
        </h4>
        <div className="flex gap-2">
          <button 
            onClick={() => setViewMode('monthly')}
            className={`cursor-pointer px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors ${viewMode === 'monthly' ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-muted border border-border text-muted-foreground hover:bg-muted/80'}`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setViewMode('yearly')}
            className={`cursor-pointer px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors ${viewMode === 'yearly' ? 'bg-primary/10 border border-primary/20 text-primary' : 'bg-muted border border-border text-muted-foreground hover:bg-muted/80'}`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="mt-auto pt-6 h-32 w-full flex items-end justify-between gap-2 sm:gap-4 px-2 overflow-x-auto no-scrollbar pb-1">
        {activeData.map((gb, i) => (
          <div key={i} className="flex-1 min-w-[28px] sm:min-w-0 flex flex-col items-center gap-2 group">
            <div className="w-full relative flex items-end justify-center h-[100px]">
              <div
                className="w-full rounded-t-xl bg-gradient-to-t from-[#8c2bee]/20 to-[#8c2bee] group-hover:from-[#8c2bee]/40 group-hover:to-[#b673ff] transition-all duration-500 relative"
                style={{ height: `${getDynamicHeight(gb)}px` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground backdrop-blur-md border border-border rounded-lg px-2 py-1 text-[8px] font-bold whitespace-nowrap z-10 pointer-events-none">
                  {gb > 0 ? gb.toFixed(2) : 0}GB
                </div>
              </div>
            </div>
            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
              {activeLabels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
