/**
 * Simple rate limiter abstraction.
 *
 * - Uses Redis (ioredis) when `REDIS_URL` is present at runtime.
 * - Falls back to an in-memory Map for single-instance development.
 */
type MemRecord = { count: number; reset: number }

let redisClient: any | null = null
let useRedis = false
try {
  if (process.env.REDIS_URL) {
    // @ts-ignore
    const IORedis = require('ioredis')
    // @ts-ignore
    redisClient = new IORedis(process.env.REDIS_URL)
    useRedis = true
  }
} catch (err) {
  // If ioredis is not installed or connecting fails, fall back to in-memory
  useRedis = false
}

;(global as any).__rateLimiterMap = (global as any).__rateLimiterMap || new Map<string, MemRecord>()
const memMap: Map<string, MemRecord> = (global as any).__rateLimiterMap

/**
 * Allow or deny a request for `key`. Returns true if the request is allowed.
 * @param key unique bucket key (e.g. `preview:user:123`)
 * @param limit max requests per window
 * @param windowSeconds window size in seconds
 */
export async function allowRequest(key: string, limit = 60, windowSeconds = 60): Promise<boolean> {
  if (useRedis && redisClient) {
    try {
      const v = await redisClient.incr(key)
      if (v === 1) {
        await redisClient.expire(key, windowSeconds)
      }
      return v <= limit
    } catch (err) {
      // On Redis error, fall back to in-memory
    }
  }

  const now = Date.now()
  const rec = memMap.get(key)
  if (!rec || now > rec.reset) {
    memMap.set(key, { count: 1, reset: now + windowSeconds * 1000 })
    return true
  }
  rec.count++
  memMap.set(key, rec)
  return rec.count <= limit
}

export default { allowRequest }
