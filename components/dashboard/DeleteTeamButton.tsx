'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2 } from 'lucide-react'

type ActionState = { error?: string }

interface DeleteTeamButtonProps {
  teamId: string
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>
}

export function DeleteTeamButton({ teamId, action }: DeleteTeamButtonProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm('Permanently delete this team? This cannot be undone.')) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="teamId" value={teamId} />
      {state?.error && (
        <p className="text-xs text-destructive mb-2">{state.error}</p>
      )}
      <Button
        type="submit"
        variant="destructive"
        disabled={isPending}
        className="h-8 w-full text-[10px] font-black uppercase tracking-widest"
      >
        {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        Delete Empty Team
      </Button>
    </form>
  )
}
