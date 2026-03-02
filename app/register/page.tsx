'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Cloud, Shield, Zap } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Registration failed')
      }

      setErrorMsg(null) // clear any previous errors
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

  return (
    <div className="min-h-screen flex">
      {/* Branded panel - hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-indigo-700 to-indigo-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2em0wIDJjLTQuNDE4IDAtOC0zLjU4Mi04LThzMy41ODItOCA4LTggOCAzLjU4MiA4IDgtMy41ODIgOC04IDh6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">S3</span>
            </div>
            <h1 className="text-3xl font-bold text-white">S3 Portal</h1>
          </div>
          <p className="text-xl text-indigo-100 mb-12 leading-relaxed">
            Get started in minutes.
            <br />
            Your team&apos;s file portal awaits.
          </p>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Cloud className="h-5 w-5 text-[#e9d5ff]" />
              </div>
              <div>
                <p className="font-medium text-white">Bring Your Own Bucket</p>
                <p className="text-sm text-[#e9d5ff]">AWS S3 and compatible storage</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-[#e9d5ff]" />
              </div>
              <div>
                <p className="font-medium text-white">Team Management</p>
                <p className="text-sm text-[#e9d5ff]">Roles, permissions, and audit trails</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-[#e9d5ff]" />
              </div>
              <div>
                <p className="font-medium text-white">Secure Sharing</p>
                <p className="text-sm text-[#e9d5ff]">Password-protected, expiring links</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-[#8c2bee] to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-[#8c2bee]/25">
              <span className="text-white font-bold text-sm">S3</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">S3 Portal</h1>
          </div>

          <Card className="border-0 shadow-xl shadow-slate-200/50">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
              <CardDescription>
                Sign up to start managing your files
              </CardDescription>
              {errorMsg && (
                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 font-medium">
                  {errorMsg}
                </div>
              )}
            </CardHeader>
            <form onSubmit={onSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    required
                    disabled={isLoading}
                    autoComplete="name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@example.com"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={8}
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4">
                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-[#8c2bee] to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-[#8c2bee]/25 transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create account'}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account?{' '}
                  <Link href="/login" className="font-medium text-[#8c2bee] hover:text-indigo-700 transition-colors">
                    Sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
