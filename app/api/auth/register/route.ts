import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/crypto'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email already registered' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password)

    // Get the OWNER role
    const ownerRole = await prisma.role.findUnique({
      where: { name: 'OWNER' },
    })

    if (!ownerRole) {
      return NextResponse.json(
        { message: 'System roles not initialized. Please run: npm run db:seed' },
        { status: 500 }
      )
    }

    // Create user, team, and team membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name: validated.name,
          email: validated.email,
          passwordHash,
        },
      })

      // Create team for the user
      const team = await tx.team.create({
        data: {
          name: `${validated.name}'s Team`,
          slug: `${validated.email.split('@')[0]}-${Date.now()}`,
          ownerId: user.id,
        },
      })

      // Add user as OWNER of the team
      await tx.teamMember.create({
        data: {
          userId: user.id,
          teamId: team.id,
          roleId: ownerRole.id,
        },
      })

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Registration error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
