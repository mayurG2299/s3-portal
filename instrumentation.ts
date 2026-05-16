export async function register() {
  // BullMQ uses ioredis and worker threads — crashes in Edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startIndexingWorker } = await import('./lib/workers/indexing-worker')
    const { startBackfillScheduler } = await import('./lib/workers/backfill-scheduler')
    startIndexingWorker()
    startBackfillScheduler()
  }
}
