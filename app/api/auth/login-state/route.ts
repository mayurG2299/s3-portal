import { NextResponse } from "next/server"
import { validateCredentials } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const result = await validateCredentials(email, password)

    return NextResponse.json({ status: result.status })
  } catch (error) {
    console.error('[auth/login-state] Error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
