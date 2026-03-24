import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGitHubStars, REPO } from '@/lib/github'
import { Button } from '@/components/ui/button'
import { SetupStepCard } from '@/components/landing/SetupStepCard'
import { GitHubStarBadge } from '@/components/landing/GitHubStarBadge'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

export default async function HomePage() {
  const [session, stars] = await Promise.all([getServerSession(authOptions), getGitHubStars()])

  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-brand/30 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-brand/10 blur-[120px] pointer-events-none" />

      <nav className="border-b border-white/5 py-4">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-white">S3 Portal</span>

          <div className="flex items-center gap-6">
            <Link href="/documentation" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Documentation
            </Link>
            <GitHubStarBadge count={stars} repo={REPO} />
            {session ? (
              <Link href="/dashboard">
                <Button className="h-10 rounded-full px-5 btn-primary-gradient text-sm font-bold">Dashboard</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button className="h-10 rounded-full px-5 btn-primary-gradient text-sm font-bold">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold mb-6">Open source self-hosted S3 portal</p>

        <h1 className="text-4xl sm:text-6xl font-black leading-[1.05] tracking-tight text-white max-w-4xl">
          Manage files in S3 with a flow your team can actually use.
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mt-6 leading-relaxed">
          Connect your S3 credentials, upload and share files, and manage team access from one clean UI.
        </p>

        <div className="flex flex-wrap gap-3 mt-10">
          {session ? (
            <Link href="/dashboard">
              <Button className="h-12 px-8 rounded-xl btn-primary-gradient text-base font-bold gap-2 group">
                Open dashboard
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button className="h-12 px-8 rounded-xl btn-primary-gradient text-base font-bold gap-2 group">
                  Get started
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </>
          )}
        </div>

        <section className="mt-16 rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500 font-semibold">Quick setup</p>
          <h3 className="text-2xl font-black text-white tracking-tight mt-2">Self-hosting steps</h3>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                step: 1,
                title: 'Download',
                desc: 'Fetch the compose file.',
                command: 'curl -LO https://github.com/mayurG2299/s3-portal/raw/main/docker-compose.yml',
              },
              {
                step: 2,
                title: 'Configure',
                desc: 'Prepare .env and set required variables.',
                command: 'cp .env.example .env\nnano .env',
              },
              {
                step: 3,
                title: 'Start',
                desc: 'Start all services with Docker Compose.',
                command: 'docker compose up -d',
              },
              {
                step: 4,
                title: 'Run migrations',
                desc: 'Run Prisma migrations on first boot.',
                command: 'docker compose run --rm app npx prisma migrate deploy',
              },
              {
                step: 5,
                title: 'Connect AWS',
                desc: 'Open the app and complete onboarding with AWS credentials.',
                command: '# Open http://localhost:3000 in your browser',
              },
            ].map((item) => (
              <SetupStepCard
                key={item.step}
                step={item.step}
                title={item.title}
                description={item.desc}
                command={item.command}
              />
            ))}
          </div>

          <p className="mt-4 text-sm text-slate-400">
            Required env vars: <span className="text-slate-200">DATABASE_URL</span>, <span className="text-slate-200">NEXTAUTH_SECRET</span>, <span className="text-slate-200">ENCRYPTION_KEY</span>, <span className="text-slate-200">NEXTAUTH_URL</span>, <span className="text-slate-200">NEXT_PUBLIC_APP_URL</span>.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-6 text-slate-500">
          <div className="inline-flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="text-emerald-500/70" />
            S3-compatible providers
          </div>
          <div className="inline-flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="text-emerald-500/70" />
            Encrypted credentials at rest
          </div>
          <div className="inline-flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="text-emerald-500/70" />
            Team RBAC and audit logs
          </div>
        </div>

      </main>

      <footer className="border-t border-white/5 mt-16 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-sm text-slate-400">
          <p>S3 Portal - Open source file management</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/mayurG2299/s3-portal" target="_blank" rel="noreferrer" className="hover:text-slate-200 transition-colors">GitHub</a>
            <a href="https://mayur.ghaadi.in" target="_blank" rel="noreferrer" className="hover:text-slate-200 transition-colors">About me</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
