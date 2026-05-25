import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildHandlerContext } from '../handlers/shared'
import { handleUpload, handleMultipartInit, handleMultipartPresign, handleMultipartComplete } from '../handlers/upload'

export async function POST(request: NextRequest) {
  try {
    const { ctx, errorResponse } = await buildHandlerContext(request)
    if (errorResponse) return errorResponse

    switch (ctx.body.action) {
      case 'upload':            return await handleUpload(ctx)
      case 'multipartInit':     return await handleMultipartInit(ctx)
      case 'multipartPresign':  return await handleMultipartPresign(ctx)
      case 'multipartComplete': return await handleMultipartComplete(ctx)
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error in files/upload API:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
