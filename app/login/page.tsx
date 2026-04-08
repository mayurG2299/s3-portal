'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Eye, EyeOff, Cloud, Shield, Zap, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const errorParam = searchParams.get('error')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const result = await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      })

      if (result?.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Invalid email or password',
        })
        return
      }

      // Force session refresh by reloading the page
      window.location.href = callbackUrl
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background text-slate-200 selection:bg-brand/30 overflow-y-auto">
      {/* Branded panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-background via-slate-950 to-background relative overflow-hidden border-r border-white/5">
        {/* Animated Background Elements */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-brand/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-violet-600/20 rounded-full blur-[120px] animate-pulse delay-700" />

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="flex items-center gap-4 mb-12 animate-fade-in">
            <div className="w-14 h-14 bg-gradient-to-br from-brand to-brand-dark rounded-2xl flex items-center justify-center shadow-2xl shadow-brand/40 transform hover:scale-105 transition-transform duration-300">
              <span className="text-white font-black text-2xl tracking-tighter">S3</span>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">S3 Portal</h1>
              <p className="text-brand-light font-medium tracking-widest text-xs uppercase">v2.0</p>
            </div>
          </div>

          <div className="space-y-2 mb-16 animate-slide-up">
            <h2 className="text-5xl font-bold text-white leading-[1.1] tracking-tight">
              High-performance <span className="gradient-text">cloud storage</span> for modern teams.
            </h2>
            <p className="text-xl text-slate-400 max-w-lg leading-relaxed pt-4">
              Manage your global data infrastructure with enterprise-grade security and blazing-fast access.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
            {[
              { icon: Cloud, title: "Direct S3 Integration", desc: "Connect any S3-compatible provider" },
              { icon: Shield, title: "Zero-Trust Security", desc: "Role-based access with audit logs" },
              { icon: Zap, title: "Parallel Uploads", desc: "Blazing fast multipart transfers" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-6 group">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-brand/10 group-hover:border-brand/30 transition-all duration-300">
                  <item.icon className="h-6 w-6 text-brand-light group-hover:text-purple-300" />
                </div>
                <div>
                  <p className="font-bold text-white group-hover:text-brand-light transition-colors uppercase tracking-tight text-sm">{item.title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-8 py-6 sm:py-8 relative">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-6 sm:mb-10 lg:hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-lg shadow-brand/25">
              <span className="text-white font-bold text-sm tracking-tighter">S3</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">S3 Portal</h1>
          </div>

          <div className="glass-morphic p-6 sm:p-10 rounded-3xl border border-white/10 relative z-10 shadow-3xl">
            <div className="mb-6 sm:mb-10 text-center sm:text-left">
              <h3 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h3>
              <p className="text-slate-400">Please enter your credentials to access the portal.</p>
              {errorParam === 'unauthorized' && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 font-medium animate-fade-in">
                  You must be logged in to access that page.
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-12 bg-white/5 border-white/10 focus:border-brand/50 focus:ring-brand/20 transition-all duration-300 text-white placeholder:text-slate-600 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-500">Password</Label>
                  <span className="text-xs font-semibold text-slate-500">Password reset coming soon</span>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="h-12 bg-white/5 border-white/10 focus:border-brand/50 focus:ring-brand/20 transition-all duration-300 text-white placeholder:text-slate-600 pr-12 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-light p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 btn-primary-gradient rounded-xl font-bold text-base gap-2 group"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Secure Sign In'}
                {!isLoading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
              </Button>
            </form>

            <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/5 text-center">
              <p className="text-sm text-slate-500">
                New to S3 Portal?{' '}
                <Link href="/register" className="font-bold text-white hover:text-brand-light underline underline-offset-4 decoration-brand/30 hover:decoration-brand-light transition-all duration-300">
                  Create an account
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 animate-fade-in" style={{ animationDelay: '500ms' }}>
            <Link href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-slate-400 transition-colors">Help Center</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
