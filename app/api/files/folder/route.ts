import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildHandlerContext } from '../handlers/shared'
import { handleCreateFolder } from '../handlers/folder'
import { handleUpdateTags } from '../handlers/metadata'

export async function POST(request: NextRequest) {
  try {
    const { ctx, errorResponse } = await buildHandlerContext(request)
    if (errorResponse) return errorResponse

    switch (ctx.body.action) {
      case 'createFolder': return await handleCreateFolder(ctx)
      case 'updateTags':   return await handleUpdateTags(ctx)
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error in files/folder API:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
