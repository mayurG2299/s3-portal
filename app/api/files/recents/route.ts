import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildHandlerContext } from '../handlers/shared'
import { handleRecents } from '../handlers/list'

export async function POST(request: NextRequest) {
  try {
    const { ctx, errorResponse } = await buildHandlerContext(request)
    if (errorResponse) return errorResponse

    return await handleRecents(ctx)
  } catch (error: any) {
    console.error('Error in files/recents API:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
