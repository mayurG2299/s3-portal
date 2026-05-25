import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildHandlerContext } from '../handlers/shared'
import { handleFavorites } from '../handlers/list'
import { handleToggleFavorite } from '../handlers/metadata'

export async function POST(request: NextRequest) {
  try {
    const { ctx, errorResponse } = await buildHandlerContext(request)
    if (errorResponse) return errorResponse

    switch (ctx.body.action) {
      case 'toggleFavorite': return await handleToggleFavorite(ctx)
      case 'favorites':      return await handleFavorites(ctx)
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error in files/favorites API:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
