import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

async function createTeam(formData: FormData) {
  'use server'

  const session = await requireUser()
  const name = formData.get('name') as string
  const slug = formData.get('slug') as string

  if (!name || !slug) {
    throw new Error('Name and slug are required')
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Slug must contain only lowercase letters, numbers, and hyphens')
  }

  // Check if slug is unique
  const existing = await prisma.team.findUnique({
    where: { slug },
  })

  if (existing) {
    throw new Error('Team slug already exists')
  }

  // Create team
  const team = await prisma.team.create({
    data: {
      name,
      slug,
      ownerId: session.user.id,
    },
  })

  // Add owner as team member
  const ownerRole = await prisma.role.findUnique({
    where: { name: 'OWNER' },
  })

  if (ownerRole) {
    await prisma.teamMember.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
        roleId: ownerRole.id,
      },
    })
  }

  redirect(`/dashboard/teams`)
}

export default async function NewTeamPage() {
  const session = await requireUser()

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
          <CardDescription>
            Choose a name and unique slug for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Marketing Team"
                required
                minLength={1}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Team Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="e.g., marketing-team"
                pattern="^[a-z0-9-]+$"
                required
                minLength={1}
                maxLength={50}
                title="Lowercase letters, numbers, and hyphens only"
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs and API calls. Must be unique.
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit">Create Team</Button>
              <Button variant="outline" asChild>
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
            <li>
              <span className="font-medium">OWNER:</span> Full control of team and settings
            </li>
            <li>
              <span className="font-medium">ADMIN:</span> Can manage files, members, and roles
            </li>
            <li>
              <span className="font-medium">VIEWER:</span> Can view files and shared links only
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
