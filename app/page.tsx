import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Cloud, Shield, Zap, Users, ArrowRight, Play, CheckCircle2 } from 'lucide-react'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-brand/30 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-brand/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Navigation */}
      <nav className="glass-navbar border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group pointer-events-none">
            <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
              <span className="text-white font-black text-lg tracking-tighter">S3</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">S3 Portal</h1>
          </div>

          <div className="flex items-center gap-6">
            {session ? (
              <Link href="/dashboard">
                <Button className="btn-primary-gradient rounded-full px-6 text-sm font-bold h-10">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button className="btn-primary-gradient rounded-full px-6 text-sm font-bold h-10">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-20 sm:pt-32 sm:pb-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-5xl sm:text-7xl font-black text-white leading-[1.05] tracking-tight mb-8 animate-slide-up">
            Your S3 Storage, <br />
            <span className="gradient-text">Finally Under Control.</span>
          </h2>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 animate-slide-up leading-relaxed" style={{ animationDelay: '100ms' }}>
            A clean, self-hostable UI for AWS S3. Manage buckets, share files, control access — without touching the AWS console.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            {session ? (
              <Link href="/dashboard">
                <Button className="h-14 px-10 rounded-2xl btn-primary-gradient text-lg font-bold gap-2 group">
                  Continue to Dashboard
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button className="h-14 px-10 rounded-2xl btn-primary-gradient text-lg font-bold gap-2 group">
                    Get Started Free
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Button variant="ghost" className="h-14 px-8 rounded-2xl border border-white/5 text-slate-300 hover:text-white hover:bg-white/5 text-lg font-bold gap-2">
                  <Play size={20} className="fill-current" />
                  Watch Demo
                </Button>
              </>
            )}
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-8 text-slate-500 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500/60" />
              <span className="text-sm font-medium">Self-hostable</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500/60" />
              <span className="text-sm font-medium">Docker ready</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500/60" />
              <span className="text-sm font-medium">Open source</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-6 bg-slate-950/50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Cloud,
                title: "Cloud Native",
                desc: "Works with AWS S3 and any S3-compatible storage. Connect multiple buckets across different providers."
              },
              {
                icon: Shield,
                title: "Zero-Trust Security",
                desc: "Role-based access control, team permissions, and full audit logs. Know exactly who did what."
              },
              {
                icon: Zap,
                title: "Built for Teams",
                desc: "Invite team members, assign roles, share files with expiring links. No AWS IAM required."
              }
            ].map((feature, i) => (
              <div key={i} className="glass-card group animate-slide-up" style={{ animationDelay: `${300 + i * 100}ms` }}>
                <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon size={24} className="text-brand-light" />
                </div>
                <h4 className="text-xl font-bold text-white mb-3 tracking-tight">{feature.title}</h4>
                <p className="text-slate-400 leading-relaxed text-sm">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="py-20 px-6 border-t border-white/5 opacity-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3 grayscale cursor-not-allowed">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <span className="text-slate-500 font-bold text-xs">S3</span>
            </div>
            <h1 className="text-lg font-bold text-slate-500">S3 Portal</h1>
          </div>

          <p className="text-xs font-medium text-slate-700">© 2026 S3 Portal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
