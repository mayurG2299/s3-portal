import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { logUserAction } from '@/lib/audit'
import { z } from 'zod'

const strongPassword = z
  .string()
  .min(8)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character')

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
  confirmPassword: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      await logUserAction({
        request,
        action: 'ACCOUNT_PASSWORD_CHANGE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = passwordSchema.parse(body)

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id, deletedAt: null },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash)
    if (!isValid) {
      await logUserAction({
        request,
        action: 'ACCOUNT_PASSWORD_CHANGE',
        success: false,
        userId: session.user.id,
        errorMessage: 'Invalid current password',
      })
      return NextResponse.json({ error: 'Invalid current password' }, { status: 400 })
    }

    const newHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    })

    await logUserAction({
      request,
      action: 'ACCOUNT_PASSWORD_CHANGE',
      success: true,
      userId: session.user.id,
      resourceType: 'user',
      resourceId: session.user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Password change error:', error)
    await logUserAction({
      request,
      action: 'ACCOUNT_PASSWORD_CHANGE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
