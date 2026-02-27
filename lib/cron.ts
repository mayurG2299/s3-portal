import { expirePendingInvites } from './invites'
import { reconcileTeam } from './s3-sync'
import { prisma } from './db'

let running = false

export async function runJobsOnce() {
  if (running) return
  running = true
  try {
    // Expire invites
    await expirePendingInvites()

    // Reconcile teams (run for all teams) - throttled
    // Skip teams whose StorageQuota.updatedAt is less than 5 hours ago
    const fiveHoursMs = 1000 * 60 * 60 * 5

    const teams = await prisma.team.findMany({ select: { id: true } })
    const quotas = await prisma.storageQuota.findMany({ select: { teamId: true, updatedAt: true } })
    const quotaMap = new Map<string, Date>(quotas.map((q) => [q.teamId, q.updatedAt]))

    for (const t of teams) {
      try {
        const updatedAt = quotaMap.get(t.id)
        if (updatedAt) {
          const age = Date.now() - new Date(updatedAt).getTime()
          if (age < fiveHoursMs) {
            // recently reconciled via quota update; skip to avoid hammering S3
            continue
          }
        }

        await reconcileTeam(t.id)
      } catch (err) {
        console.error('Error reconciling team', t.id, err)
      }
    }
  } finally {
    running = false
  }
}

export function startBackgroundJobs() {
  // Run on startup and then every 6 hours
  runJobsOnce().catch((err) => console.error('Cron startup error:', err))

  const sixHours = 1000 * 60 * 60 * 6
  setInterval(() => {
    runJobsOnce().catch((err) => console.error('Scheduled job error:', err))
  }, sixHours)
}
