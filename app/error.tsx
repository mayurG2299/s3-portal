"use client"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: '#b91c1c' }}>Something went wrong</h1>
      <p style={{ marginTop: 16 }}>{error.message || 'An unexpected error occurred.'}</p>
      <button
        style={{ marginTop: 24, padding: '8px 24px', fontSize: 16, borderRadius: 6, background: '#f87171', color: '#fff', border: 'none', cursor: 'pointer' }}
        onClick={() => reset()}
      >
        Try Again
      </button>
    </div>
  )
}
