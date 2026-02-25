/**
 * Standardized API error handling and responses
 * Ensures consistent error responses while logging internal details securely
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger } from './logger'

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'APIError'
  }
}

interface ErrorResponse {
  message: string
  code?: string
  details?: Record<string, any>
}

/**
 * Creates a standardized error response
 */
function createErrorResponse(
  statusCode: number,
  message: string,
  code?: string,
  details?: Record<string, any>
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = { message }
  if (code) response.code = code
  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Central error handler for API routes
 * Logs internal details and returns safe client responses
 */
export function handleAPIError(
  error: any,
  requestId?: string
): NextResponse<ErrorResponse> {
  const id = requestId || crypto.randomUUID()

  // Zod validation errors
  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      requestId: id,
      errors: error.errors,
    })

    return createErrorResponse(
      400,
      'Validation failed',
      'VALIDATION_ERROR',
      process.env.NODE_ENV === 'development'
        ? { errors: error.errors }
        : undefined
    )
  }

  // Custom API errors
  if (error instanceof APIError) {
    const shouldLogAsError = error.statusCode >= 500
    const logFn = shouldLogAsError ? logger.error : logger.warn

    logFn(`API Error: ${error.message}`, {
      statusCode: error.statusCode,
      context: error.context,
      requestId: id,
    })

    return createErrorResponse(error.statusCode, error.message)
  }

  // JSON parsing errors
  if (error instanceof SyntaxError && 'body' in error) {
    logger.warn('JSON parse error', { requestId: id })
    return createErrorResponse(400, 'Invalid request body', 'PARSE_ERROR')
  }

  // Database errors
  if (error.code === 'P2002') {
    logger.warn('Database constraint violation', {
      requestId: id,
      code: error.code,
    })
    return createErrorResponse(
      409,
      'Resource already exists',
      'CONFLICT'
    )
  }

  if (error.code === 'P2025') {
    logger.warn('Database record not found', { requestId: id })
    return createErrorResponse(404, 'Not found', 'NOT_FOUND')
  }

  // Generic database errors
  if (error.name === 'PrismaClientKnownRequestError') {
    logger.error('Database error', {
      requestId: id,
      code: error.code,
      message: error.message,
    })
    return createErrorResponse(
      500,
      'Database operation failed',
      'DB_ERROR'
    )
  }

  // Unexpected errors - log stack trace
  logger.error('Unexpected error', {
    requestId: id,
    message: error.message,
    stack: error.stack,
    type: error.constructor.name,
  })

  return createErrorResponse(
    500,
    'Internal server error',
    'INTERNAL_ERROR'
  )
}

/**
 * Middleware to wrap API handlers with error handling
 */
export function withErrorHandling(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request): Promise<NextResponse> => {
    const requestId = crypto.randomUUID()
    
    try {
      return await handler(request)
    } catch (error) {
      return handleAPIError(error, requestId)
    }
  }
}
