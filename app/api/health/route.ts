/**
 * Health check endpoint for monitoring and orchestration tools
 * Used by Docker, Kubernetes, and load balancers to verify app status
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  timestamp: string
  checks: {
    database: 'ok' | 'error'
    uptime: number
  }
}

const startTime = Date.now()

export async function GET(): Promise<NextResponse<HealthResponse>> {
  let status: 'ok' | 'degraded' = 'ok'
  let dbStatus: 'ok' | 'error' = 'ok'

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    dbStatus = 'error'
    status = 'degraded'
  }

  const checks = {
    database: dbStatus,
  }

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      ...checks,
      uptime: Date.now() - startTime,
    },
  }

  return NextResponse.json(response, {
    status: status === 'ok' ? 200 : 503,
  })
}
