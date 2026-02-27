#!/usr/bin/env node
import 'dotenv/config'
import { startBackgroundJobs } from '../lib/cron'

async function main() {
  console.log('Starting cron worker...')
  startBackgroundJobs()

  // Keep process running
  process.stdin.resume()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
