import { publishFileChanged, createFileEventStream } from '@/lib/events/files'
import type { FileChangedPayload } from '@/lib/events/types'

describe('publishFileChanged', () => {
  it('is a no-op when no subscribers exist for the teamId', () => {
    expect(() =>
      publishFileChanged('team-no-subscribers', { bucketId: 'b1', action: 'uploaded' })
    ).not.toThrow()
  })

  it('enqueues a file-changed SSE event to all subscribers for the teamId', async () => {
    const received: string[] = []
    const decoder = new TextDecoder()

    const stream = createFileEventStream('team-abc')

    const reader = stream.getReader()
    // Consume the initial ':connected\n\n' chunk
    await reader.read()

    const payload: FileChangedPayload = { bucketId: 'bucket-1', action: 'deleted', key: 'x/y.png' }
    publishFileChanged('team-abc', payload)

    const { value } = await reader.read()
    received.push(decoder.decode(value))
    reader.cancel()

    expect(received[0]).toBe(
      `event: file-changed\ndata: ${JSON.stringify(payload)}\n\n`
    )
  })

  it('does not deliver to subscribers of a different teamId', async () => {
    const stream = createFileEventStream('team-X')
    const reader = stream.getReader()
    await reader.read() // consume :connected

    publishFileChanged('team-Y', { bucketId: 'b', action: 'uploaded' })

    // No event should arrive — race with a timeout to confirm
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 50))
    const readRace = reader.read()
    const result = await Promise.race([readRace, timeout])
    reader.cancel()

    expect(result).toBeNull()
  })
})

describe('createFileEventStream', () => {
  it('sends :connected comment immediately on subscription', async () => {
    const decoder = new TextDecoder()
    const stream = createFileEventStream('team-connect-test')
    const reader = stream.getReader()
    const { value } = await reader.read()
    reader.cancel()
    expect(decoder.decode(value)).toBe(': connected\n\n')
  })
})
