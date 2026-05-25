'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export default function NewTeamPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(toSlug(value))
  }

  const handleSlugChange = (value: string) => {
    setSlug(value)
    setSlugTouched(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim() || !slug.trim()) { setError('Name and slug are required'); return }
    if (!/^[a-z0-9-]+$/.test(slug)) { setError('Slug must contain only lowercase letters, numbers, and hyphens'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.message || 'Failed to create team'); return }
      router.push('/dashboard/teams')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Team</h1>
        <p className="text-muted-foreground mt-2">
          Teams allow you to organize team members and manage shared resources.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Information</CardTitle>
          <CardDescription>Choose a name and unique slug for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Marketing Team"
                required
                maxLength={100}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Team Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g., marketing-team"
                required
                maxLength={50}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs and API calls. Must be unique.
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Creating…' : 'Create Team'}
              </Button>
              <Button variant="outline" asChild disabled={loading}>
                <Link href="/dashboard/teams">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li><span className="font-medium">OWNER:</span> Full control of team and settings</li>
            <li><span className="font-medium">ADMIN:</span> Can manage files, members, and roles</li>
            <li><span className="font-medium">VIEWER:</span> Can view files and shared links only</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
