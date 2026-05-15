import Link from 'next/link'
import { WarningCircle, Warning, CheckCircle, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DashboardAction } from '@/lib/dashboard-action-center'

interface ActionCenterProps {
  actions: DashboardAction[]
}

export function ActionCenter({ actions }: ActionCenterProps) {
  return (
    <div className="glass-card h-full">
      <div className="flex items-center justify-between mb-8">
        <h4 className="text-sm font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
          Action Center
        </h4>
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.18em]">
          Priority Queue
        </span>
      </div>

      <div className="space-y-4">
        {actions.map((action) => {
          const isCritical = action.severity === 'critical'
          const isWarning = action.severity === 'warning'
          const severityLabel = isCritical ? 'Critical' : isWarning ? 'Warning' : 'Ready'
          const SeverityIcon = isCritical ? WarningCircle : isWarning ? Warning : CheckCircle

          return (
            <div
              key={action.id}
              className={cn(
                'rounded-2xl border p-4 transition-all duration-300 flex flex-col',
                isCritical && 'border-destructive/30 bg-destructive/5',
                isWarning && 'border-amber-500/30 bg-amber-500/5',
                !isCritical && !isWarning && 'border-border bg-card/60'
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2">
                  <SeverityIcon
                    className={cn(
                      'h-4 w-4 mt-0.5',
                      isCritical && 'text-destructive',
                      isWarning && 'text-amber-500',
                      !isCritical && !isWarning && 'text-emerald-500'
                    )}
                  />
                  <div>
                    <p className="text-sm font-bold text-foreground">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{action.description}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[9px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-md border whitespace-nowrap',
                    isCritical && 'text-destructive border-destructive/30 bg-destructive/10',
                    isWarning && 'text-amber-600 border-amber-500/30 bg-amber-500/10',
                    !isCritical && !isWarning && 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                  )}
                >
                  {severityLabel}
                </span>
              </div>

              <div className="mt-auto pt-3 border-t border-border/40">
                <Button asChild size="sm" variant="outline" className="rounded-xl font-semibold">
                  <Link href={action.href}>
                    {action.ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" weight="bold" />
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
