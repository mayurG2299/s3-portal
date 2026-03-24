'use client'

import { useToast } from '@/hooks/use-toast'

interface SetupStepCardProps {
  step: number
  title: string
  description: string
  command: string
}

export function SetupStepCard({ step, title, description, command }: SetupStepCardProps) {
  const { toast } = useToast()

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command)
      toast({
        title: 'Copied',
        description: `Step ${step} command copied to clipboard.`,
      })
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy command. Please copy manually.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-5">
      <div className="w-7 h-7 rounded-full bg-brand/20 text-brand-light font-bold text-sm flex items-center justify-center mb-3">{step}</div>
      <h4 className="text-base font-bold text-white mb-1">{title}</h4>
      <p className="text-sm text-slate-400 leading-relaxed mb-4">{description}</p>

      <div className="rounded-lg border border-white/10 bg-black/40 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Command</span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-slate-300 border border-white/15 rounded-md px-2.5 py-1 hover:bg-white/5 transition"
          >
            Copy
          </button>
        </div>
        <pre className="text-xs sm:text-sm text-slate-300 leading-relaxed p-3 whitespace-pre-wrap">{command}</pre>
      </div>
    </div>
  )
}
