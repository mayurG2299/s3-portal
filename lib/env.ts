/**
 * Environment variable validation
 * Ensures all required configuration is present and valid at startup
 */

export interface AppConfig {
  database: {
    url: string
  }
  auth: {
    secret: string
    url: string
  }
  encryption: {
    key: string
  }
  app: {
    url: string
    env: 'development' | 'production' | 'test'
  }
}

/**
 * Validate and load environment configuration
 * Throws error if validation fails - prevents app from starting with missing config
 */
export function loadConfig(): AppConfig {
  const {
    DATABASE_URL,
    NEXTAUTH_SECRET,
    NEXTAUTH_URL,
    ENCRYPTION_KEY,
    NEXT_PUBLIC_APP_URL,
    NODE_ENV = 'production',
  } = process.env

  // Validate required variables
  const errors: string[] = []

  if (!DATABASE_URL) {
    errors.push('DATABASE_URL is required')
  }

  if (!NEXTAUTH_SECRET || NEXTAUTH_SECRET.length < 32) {
    errors.push(
      'NEXTAUTH_SECRET must be at least 32 characters'
    )
  }

  if (!NEXTAUTH_URL) {
    errors.push('NEXTAUTH_URL is required')
  }

  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    errors.push(
      'ENCRYPTION_KEY must be at least 32 characters'
    )
  }

  if (errors.length > 0) {
    const message = `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    throw new Error(message)
  }

  return {
    database: {
      url: DATABASE_URL!,
    },
    auth: {
      secret: NEXTAUTH_SECRET!,
      url: NEXTAUTH_URL!,
    },
    encryption: {
      key: ENCRYPTION_KEY!,
    },
    app: {
      url: NEXT_PUBLIC_APP_URL || NEXTAUTH_URL!,
      env: NODE_ENV as any,
    },
  }
}

// Validate on module load in production
if (process.env.NODE_ENV === 'production') {
  loadConfig()
}

export const config = loadConfig()
