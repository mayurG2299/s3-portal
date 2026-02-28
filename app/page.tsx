import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Cloud, Shield, Zap, Users, ArrowRight, Play, CheckCircle2 } from 'lucide-react'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 selection:bg-[#8c2bee]/30 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[500px] bg-[#8c2bee]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Navigation */}
      <nav className="glass-navbar border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group pointer-events-none">
            <div className="w-10 h-10 bg-gradient-to-br from-[#8c2bee] to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-[#8c2bee]/20">
              <span className="text-white font-black text-lg tracking-tighter">S3</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight">S3 Portal</h1>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">Documentation</Link>
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#8c2bee]/10 border border-[#8c2bee]/20 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#b673ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8c2bee]"></span>
            </span>
            <span className="text-xs font-bold text-[#d8b4fe] uppercase tracking-widest">v2.0 Landing</span>
          </div>

          <h2 className="text-5xl sm:text-7xl font-black text-white leading-[1.05] tracking-tight mb-8 animate-slide-up">
            Your S3 Storage, <br />
            <span className="gradient-text">Beautifully Reimagined.</span>
          </h2>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 animate-slide-up leading-relaxed" style={{ animationDelay: '100ms' }}>
            The enterprise-grade portal for AWS S3. Securely manage, share, and collaborate on your files with a high-performance, glassmorphic interface.
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
              <span className="text-sm font-medium">No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500/60" />
              <span className="text-sm font-medium">SSL Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500/60" />
              <span className="text-sm font-medium">GDPR Compliant</span>
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
                desc: "Full integration with AWS S3, Wasabi, DigitalOcean Spaces, and more."
              },
              {
                icon: Shield,
                title: "Zero-Trust",
                desc: "State-of-the-art security with granular role-based access and full audit logs."
              },
              {
                icon: Zap,
                title: "Ultra Fast",
                desc: "Optimized multipart uploads and lightning-quick file indexing for massive buckets."
              }
            ].map((feature, i) => (
              <div key={i} className="glass-card group animate-slide-up" style={{ animationDelay: `${300 + i * 100}ms` }}>
                <div className="w-12 h-12 rounded-2xl bg-[#8c2bee]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon size={24} className="text-[#b673ff]" />
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

          <div className="flex gap-10">
            <div className="flex flex-col gap-4">
              <p className="text-[#b673ff] font-medium tracking-widest text-xs uppercase">v2.0</p>
              <Link href="#" className="text-sm hover:text-white transition-colors">Features</Link>
              <Link href="#" className="text-sm hover:text-white transition-colors">Security</Link>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Company</p>
              <Link href="#" className="text-sm hover:text-white transition-colors">About</Link>
              <Link href="#" className="text-sm hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
        <p className="text-center mt-20 text-xs font-medium text-slate-700">© 2026 S3 Portal. All rights reserved.</p>
      </footer>
    </div>
  )
}
