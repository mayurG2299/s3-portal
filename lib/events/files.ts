// NOTE: In-memory only — does not work across multiple server instances.
import type { FileChangedPayload } from './types'

const encoder = new TextEncoder()
const HEARTBEAT_INTERVAL_MS = 25_000

type FileController = ReadableStreamDefaultController<Uint8Array>

const fileClients = new Map<string, Set<FileController>>()

export function publishFileChanged(teamId: string, payload: FileChangedPayload): void {
  const controllers = fileClients.get(teamId)
  if (!controllers || controllers.size === 0) return

  const data = encoder.encode(`event: file-changed\ndata: ${JSON.stringify(payload)}\n\n`)

  for (const controller of controllers) {
    try {
      controller.enqueue(data)
    } catch {
      controllers.delete(controller)
    }
  }

  if (controllers.size === 0) {
    fileClients.delete(teamId)
  }
}

export function createFileEventStream(teamId: string): ReadableStream<Uint8Array> {
  let cleanup: (() => void) | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let controllers = fileClients.get(teamId)
      if (!controllers) {
        controllers = new Set<FileController>()
        fileClients.set(teamId, controllers)
      }
      controllers.add(controller)

      controller.enqueue(encoder.encode(': connected\n\n'))

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(heartbeat)
          controllers?.delete(controller)
          if (controllers && controllers.size === 0) {
            fileClients.delete(teamId)
          }
        }
      }, HEARTBEAT_INTERVAL_MS)

      cleanup = () => {
        clearInterval(heartbeat)
        controllers?.delete(controller)
        if (controllers && controllers.size === 0) {
          fileClients.delete(teamId)
        }
      }
    },
    cancel() {
      if (cleanup) cleanup()
    },
  })
}
