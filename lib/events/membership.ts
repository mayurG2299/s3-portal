/**
 * In-memory broker for per-user membership change events used by SSE clients.
 * This keeps route handlers thin and avoids coupling API handlers directly.
 */

const encoder = new TextEncoder()
const HEARTBEAT_INTERVAL_MS = 25_000

type MembershipController = ReadableStreamDefaultController<Uint8Array>

const membershipClients = new Map<string, Set<MembershipController>>()

/**
 * Publishes a membership change event to all active SSE subscribers for a user.
 * @param userId User id whose active subscribers should receive the event.
 */
export function publishMembershipChanged(userId: string): void {
  const controllers = membershipClients.get(userId)
  if (!controllers || controllers.size === 0) return

  const payload = encoder.encode('event: membership\ndata: {"changed":true}\n\n')

  for (const controller of controllers) {
    try {
      controller.enqueue(payload)
    } catch {
      controllers.delete(controller)
    }
  }

  if (controllers.size === 0) {
    membershipClients.delete(userId)
  }
}

/**
 * Creates a readable SSE stream for membership events scoped to a user.
 * @param userId Authenticated user id that owns this SSE stream.
 * @returns Readable stream that emits keepalive comments and membership events.
 */
export function createMembershipEventStream(userId: string): ReadableStream<Uint8Array> {
  let cleanup: (() => void) | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let controllers = membershipClients.get(userId)
      if (!controllers) {
        controllers = new Set<MembershipController>()
        membershipClients.set(userId, controllers)
      }
      controllers.add(controller)

      // Initial keepalive/comment line confirms stream establishment.
      controller.enqueue(encoder.encode(': connected\n\n'))

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(heartbeat)
          controllers?.delete(controller)
          if (controllers && controllers.size === 0) {
            membershipClients.delete(userId)
          }
        }
      }, HEARTBEAT_INTERVAL_MS)

      cleanup = () => {
        clearInterval(heartbeat)
        controllers?.delete(controller)
        if (controllers && controllers.size === 0) {
          membershipClients.delete(userId)
        }
      }
    },
    cancel() {
      if (cleanup) cleanup()
    },
  })
}