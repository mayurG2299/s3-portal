'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import {
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Terminal,
} from 'lucide-react'

interface ProviderStatus {
  configured: boolean
  maskedKey: string | null
}

interface CredentialStatus {
  openai: ProviderStatus
  anthropic: ProviderStatus
  envOnly: boolean
}

interface TestResult {
  ok: boolean
  error?: string
}

interface TestResponse {
  openai: TestResult
  anthropic: TestResult
}

function ProviderCard({
  name,
  envVar,
  status,
  testResult,
  testing,
}: {
  name: string
  envVar: string
  status: ProviderStatus | null
  testResult: TestResult | null
  testing: boolean
}) {
  const isConfigured = status?.configured ?? false

  return (
    <div className="glass-card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h4 className="text-sm font-bold text-foreground">{name}</h4>
          <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono mt-1 inline-block">
            {envVar}
          </code>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border',
          isConfigured
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
        )}>
          {isConfigured
            ? <><CheckCircle className="h-3.5 w-3.5" /> Configured</>
            : <><XCircle className="h-3.5 w-3.5" /> Not configured</>
          }
        </div>
      </div>

      {isConfigured && status?.maskedKey && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Eye className="h-3.5 w-3.5" />
          <span>Key ending in <span className="font-mono font-bold text-foreground">{status.maskedKey}</span></span>
        </div>
      )}

      {testResult && (
        <div className={cn(
          'flex items-start gap-2 p-3 rounded-xl text-xs border mb-4',
          testResult.ok
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        )}>
          {testResult.ok
            ? <><CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>Connection successful</span></>
            : <><XCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{testResult.error || 'Connection failed'}</span></>
          }
        </div>
      )}

      {testing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Testing connection…
        </div>
      )}

      {!isConfigured && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Set <code className="font-mono font-bold">{envVar}</code> in your deployment environment to enable this provider.</span>
        </div>
      )}
    </div>
  )
}

export function AiCredentialsTab() {
  const [status, setStatus] = useState<CredentialStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [testResults, setTestResults] = useState<TestResponse | null>(null)
  const [testing, setTesting] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/admin/ai-credentials')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setStatus(data)
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load AI credential status' })
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const runTest = useCallback(async () => {
    setTesting(true)
    setTestResults(null)
    try {
      const res = await fetch('/api/admin/ai-credentials/test', { method: 'POST' })
      if (!res.ok) throw new Error('Test request failed')
      const data = await res.json()
      setTestResults(data)
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Connection test failed' })
    } finally {
      setTesting(false)
    }
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
            <Database size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">AI &amp; Indexing</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Configure AI provider credentials for semantic search &amp; indexing
            </p>
          </div>
        </div>
        <button
          onClick={runTest}
          disabled={testing || loadingStatus}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all',
            testing
              ? 'border-border text-muted-foreground cursor-wait'
              : 'btn-primary-gradient border-brand/20 text-white'
          )}
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {testing ? 'Testing…' : 'Test connections'}
        </button>
      </div>

      {/* Env-only notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
        <Terminal className="h-5 w-5 shrink-0 mt-0.5 text-blue-400" />
        <div className="text-sm">
          <p className="font-bold mb-1">Environment-based configuration</p>
          <p className="text-xs text-blue-300/80 leading-relaxed">
            AI credentials are loaded from server environment variables. Set them in your deployment configuration
            (e.g., <code className="font-mono bg-blue-500/10 px-1 rounded">.env</code>, Docker compose, or your hosting platform's secrets manager).
          </p>
        </div>
      </div>

      {/* Provider cards */}
      {loadingStatus ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading credential status…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ProviderCard
            name="OpenAI"
            envVar="OPENAI_API_KEY"
            status={status?.openai ?? null}
            testResult={testResults?.openai ?? null}
            testing={testing}
          />
          <ProviderCard
            name="Anthropic"
            envVar="ANTHROPIC_API_KEY"
            status={status?.anthropic ?? null}
            testResult={testResults?.anthropic ?? null}
            testing={testing}
          />
        </div>
      )}

      {/* Indexing info */}
      <div className="glass-card">
        <h4 className="text-sm font-bold text-foreground mb-4">How indexing works</h4>
        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[9px] font-black text-brand shrink-0 mt-0.5">1</div>
            <p><span className="font-semibold text-foreground">Upload</span> — Files are queued for indexing automatically after upload.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[9px] font-black text-brand shrink-0 mt-0.5">2</div>
            <p><span className="font-semibold text-foreground">Extract</span> — OpenAI Whisper (audio/video), GPT-4o Vision (images), or direct text extraction for documents.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[9px] font-black text-brand shrink-0 mt-0.5">3</div>
            <p><span className="font-semibold text-foreground">Embed</span> — Summaries are embedded via <code className="font-mono bg-muted px-1 rounded">text-embedding-3-small</code> and stored in pgvector.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[9px] font-black text-brand shrink-0 mt-0.5">4</div>
            <p><span className="font-semibold text-foreground">Search</span> — ⌘K or the AI Search page runs a similarity query against all indexed files.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
