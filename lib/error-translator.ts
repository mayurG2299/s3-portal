/**
 * AWS Error to User-Friendly Message Translator
 * Converts AWS SDK error messages to plain English explanations
 * that help everyday users understand what went wrong and how to fix it
 */

export type AWSErrorType = 
  | 'InvalidAccessKeyId'
  | 'SignatureDoesNotMatch'
  | 'AccessDenied'
  | 'NoSuchBucket'
  | 'ExpiredToken'
  | 'InvalidToken'
  | 'NoSuchKey'
  | 'ServiceUnavailable'
  | 'RequestTimeout'

interface TranslatedError {
  message: string
  suggestion: string
  learnMoreLink?: string
}

/**
 * Translates AWS SDK error messages to user-friendly explanations
 * @param errorMessage - The raw error message from AWS SDK
 * @returns Translated error with message and actionable suggestion
 */
export function translateAWSError(errorMessage: string): TranslatedError {
  // Handle null/undefined
  if (!errorMessage || typeof errorMessage !== 'string') {
    return {
      message: 'Connection failed. Please verify your AWS credentials and try again.',
      suggestion: 'Double-check your Access Key ID and Secret Access Key',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  const lowerError = errorMessage.toLowerCase()

  // Invalid credential - raw token error
  if (lowerError.includes('the security token included in the request is invalid')) {
    return {
      message: 'Your AWS credentials are incorrect.',
      suggestion: 'Please check your Access Key ID and Secret Access Key. Make sure there are no extra spaces.',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  // Invalid Access Key ID (doesn't exist in AWS)
  if (lowerError.includes('invalidsecretaccesskey') || 
      errorMessage.includes('InvalidAccessKeyId') ||
      lowerError.includes('invalid access key')) {
    return {
      message: 'This Access Key ID doesn\'t exist in AWS.',
      suggestion: 'Create a new AWS Access Key in the IAM console or use an existing one.',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  // Signature mismatch (usually wrong secret key)
  if (errorMessage.includes('SignatureDoesNotMatch') || 
      lowerError.includes('signature does not match')) {
    return {
      message: 'Your AWS Secret Access Key is incorrect.',
      suggestion: 'The Secret Access Key you provided doesn\'t match your Access Key ID. Check the IAM console.',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  // Access denied (IAM permissions issue)
  if (errorMessage.includes('AccessDenied') || 
      lowerError.includes('access denied') ||
      lowerError.includes('user') && lowerError.includes('not authorized')) {
    return {
      message: 'These AWS credentials don\'t have permission to access this bucket.',
      suggestion: 'Ask your AWS administrator to add S3 permissions to this IAM user. Check your IAM policy.',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  // Bucket doesn't exist or no access
  if (errorMessage.includes('NoSuchBucket') || 
      lowerError.includes('the specified bucket does not exist')) {
    return {
      message: 'This S3 bucket doesn\'t exist or you don\'t have access to it.',
      suggestion: 'Check that the bucket name is correct and exists in the same AWS region.',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  // Expired token or session
  if (errorMessage.includes('ExpiredToken') || 
      errorMessage.includes('InvalidToken') ||
      lowerError.includes('expired')) {
    return {
      message: 'Your AWS session has expired.',
      suggestion: 'Disconnect and reconnect your AWS credentials to refresh the session.',
      learnMoreLink: '/documentation/aws-setup'
    }
  }

  // File/object doesn't exist
  if (errorMessage.includes('NoSuchKey')) {
    return {
      message: 'This file no longer exists in your S3 bucket.',
      suggestion: 'The file may have been deleted. Refresh the file list to update.',
      learnMoreLink: undefined
    }
  }

  // Service unavailable (AWS is down)
  if (errorMessage.includes('ServiceUnavailable') || 
      lowerError.includes('service is unavailable')) {
    return {
      message: 'AWS S3 service is temporarily unavailable.',
      suggestion: 'Wait a few moments and try again. Check AWS status page if the problem persists.',
      learnMoreLink: undefined
    }
  }

  // Timeout
  if (errorMessage.includes('RequestTimeout') || 
      lowerError.includes('timed out')) {
    return {
      message: 'The request took too long and timed out.',
      suggestion: 'Check your internet connection and try again. For large files, check file size limits.',
      learnMoreLink: undefined
    }
  }

  // Generic fallback for unknown errors
  return {
    message: 'AWS connection failed. Please verify your credentials and try again.',
    suggestion: 'Check that your Access Key ID and Secret Access Key are correct and have S3 permissions.',
    learnMoreLink: '/documentation/aws-setup'
  }
}

/**
 * Determines if an error is recoverable by the user
 * @param errorMessage - The raw error message
 * @returns true if user can fix this (bad credentials), false if permissions/service issue
 */
export function isRecoverableError(errorMessage: string): boolean {
  const lowerError = errorMessage.toLowerCase()
  
  // Recoverable: user entered wrong credentials
  if (lowerError.includes('invalid') || 
      lowerError.includes('signature does not match') ||
      lowerError.includes('the security token')) {
    return true
  }
  
  // Not recoverable: permission/service issues
  return false
}

/**
 * Extracts the AWS error code from error message if present
 * Useful for logging/debugging server-side
 * @param errorMessage - The raw error message
 * @returns AWS error code or undefined
 */
export function extractAWSErrorCode(errorMessage: string): string | undefined {
  // Common AWS error code patterns:
  // Code: InvalidAccessKeyId
  // InvalidAccessKeyId:
  // { Code: 'NoSuchBucket', ... }
  
  const codeMatch = errorMessage.match(/(?:Code|Error)['"]?\s*:?\s*['"]?([A-Z][a-zA-Z0-9]+)/);
  return codeMatch?.[1];
}

/**
 * Translates any error (AWS, database, network, etc.) to user-friendly message
 * @param error - Error object or message string
 * @returns Translated error with message and suggestion
 */
export function translateError(error: unknown): TranslatedError {
  let errorMessage = 'Unknown error'
  
  if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as any).message)
  }

  // Check if it's an AWS error
  if (errorMessage.includes('InvalidAccessKeyId') || 
      errorMessage.includes('SignatureDoesNotMatch') ||
      errorMessage.includes('AccessDenied') ||
      errorMessage.includes('NoSuchBucket') ||
      errorMessage.includes('NoSuchKey') ||
      errorMessage.includes('ExpiredToken') ||
      errorMessage.includes('ServiceUnavailable') ||
      errorMessage.includes('RequestTimeout')) {
    return translateAWSError(errorMessage)
  }

  // Database connection error
  if (errorMessage.includes('ECONNREFUSED') || 
      errorMessage.includes('database') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNRESET')) {
    return {
      message: 'Service temporarily unavailable. Please try again.',
      suggestion: 'If this problem continues, contact your administrator.',
    }
  }

  // Network error
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('network')) {
    return {
      message: 'Connection timeout. Please check your network.',
      suggestion: 'Check your internet connection and try again.',
    }
  }

  // CORS error
  if (errorMessage.includes('CORS') || 
      errorMessage.includes('cross-origin')) {
    return {
      message: 'Upload blocked by storage configuration.',
      suggestion: 'Contact your administrator to configure cross-origin settings.',
    }
  }

  // Storage quota exceeded
  if (errorMessage.includes('quota') || 
      errorMessage.includes('limit') && errorMessage.includes('storage')) {
    return {
      message: 'Storage limit reached. Please remove files or contact your admin.',
      suggestion: 'Delete some files to free up space, or request a storage increase.',
    }
  }

  // Generic fallback
  return {
    message: 'Something went wrong. Please try again.',
    suggestion: 'If the problem continues, contact your administrator.',
  }
}
