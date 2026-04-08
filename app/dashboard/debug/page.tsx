
import { requireUser } from '@/lib/auth'
import DebugSessionClient from './debug-session-client'

export default async function DebugPage() {
  const session = await requireUser()
  return <DebugSessionClient session={session} />
}

// Client component for rendering session info
// app/dashboard/debug/debug-session-client.tsx
