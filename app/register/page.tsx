'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Cloud, Shield, Zap, Check, X, ArrowRight, EyeOff, Eye } from 'lucide-react'

// Same validation rules as profile/change-password page
function getPasswordRequirements(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

function isStrongPassword(password: string) {
  return getPasswordRequirements(password).every((r) => r.met)
}

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const requirements = getPasswordRequirements(password)
  const allMet = requirements.every((r) => r.met)
  const strength = requirements.filter((r) => r.met).length

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const pw = String(formData.get('password') || '')

    if (!isStrongPassword(pw)) {
      setErrorMsg(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      )
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          password: pw,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Registration failed')
      }

      setErrorMsg(null)
      toast({
        title: 'Success',
        description: 'Account created! Please sign in.',
      })
      router.push('/login')
    } catch (error: any) {
      setErrorMsg(error.message)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const strengthColor =
    strength <= 1
      ? 'bg-red-500'
      : strength <= 2
        ? 'bg-orange-500'
        : strength <= 3
          ? 'bg-yellow-500'
          : strength <= 4
            ? 'bg-blue-500'
            : 'bg-emerald-500'

  const strengthLabel =
    strength <= 1
      ? 'Very weak'
      : strength <= 2
        ? 'Weak'
        : strength <= 3
          ? 'Fair'
          : strength <= 4
            ? 'Good'
            : 'Strong'

  return (
    <div className="min-h-screen flex bg-background text-slate-200 selection:bg-brand/30">
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
                  <p className="font-bold text-lg text-white group-hover:text-brand-light transition-colors uppercase tracking-tight text-sm">{item.title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 pt-10 border-t border-white/5 flex items-center gap-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-slate-900 bg-slate-800" />
              ))}
            </div>
            <p className="text-sm text-slate-500 font-medium italic">Trusted by world class engineering teams.</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-y-auto">
        <div className="w-full max-w-md animate-slide-up my-auto">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-dark rounded-xl flex items-center justify-center shadow-lg shadow-brand/25">
              <span className="text-white font-bold text-sm tracking-tighter">S3</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">S3 Portal</h1>
          </div>

          <div className="glass-morphic p-8 sm:p-10 rounded-3xl border border-white/10 relative z-10 shadow-3xl">
            <div className="mb-10 text-center sm:text-left">
              <h3 className="text-3xl font-bold text-white tracking-tight mb-2">Create an account</h3>
              <p className="text-slate-400">Sign up to start managing your files</p>
              {errorMsg && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 font-medium animate-fade-in">
                  {errorMsg}
                </div>
              )}
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  className="h-12 bg-white/5 border-white/10 focus:border-brand/50 focus:ring-brand/20 transition-all duration-300 text-white placeholder:text-slate-600 rounded-xl"
                />
              </div>

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
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setPasswordTouched(true)
                    }}
                    disabled={isLoading}
                    autoComplete="new-password"
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

                {/* Strength bar */}
                {passwordTouched && password.length > 0 && (
                  <div className="space-y-3 mt-4 animate-fade-in bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-1 flex-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor : 'bg-slate-700/50'
                              }`}
                          />
                        ))}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest ml-3 ${strength <= 2
                          ? 'text-red-500'
                          : strength <= 3
                            ? 'text-yellow-500'
                            : strength <= 4
                              ? 'text-blue-500'
                              : 'text-emerald-500'
                          }`}
                      >
                        {strengthLabel}
                      </span>
                    </div>

                    {/* Requirements checklist */}
                    <ul className="space-y-2 pt-2 border-t border-white/5">
                      {requirements.map((req) => (
                        <li key={req.label} className="flex items-center gap-2">
                          {req.met ? (
                            <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-slate-600 flex-shrink-0" />
                          )}
                          <span
                            className={`text-xs transition-colors ${req.met
                              ? 'text-emerald-500'
                              : 'text-slate-500'
                              }`}
                          >
                            {req.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Static hint when untouched */}
                {!passwordTouched && (
                  <p className="text-xs text-slate-500 ml-1 mt-2">
                    Must be 8+ chars with uppercase, lowercase, number &amp; special character.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 btn-primary-gradient rounded-xl font-bold text-base gap-2 group mt-8"
                disabled={isLoading || (passwordTouched && !allMet)}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
                {!isLoading && (passwordTouched && !allMet ? null : <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />)}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-white hover:text-brand-light underline underline-offset-4 decoration-brand/30 hover:decoration-brand-light transition-all duration-300">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600 animate-fade-in" style={{ animationDelay: '500ms' }}>
            <Link href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-slate-400 transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-slate-400 transition-colors">Help Center</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
