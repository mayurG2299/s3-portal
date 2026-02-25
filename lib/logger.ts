/**
 * Centralized logging system for production monitoring
 * Supports structured logging with JSON output for log aggregation services
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const LOG_LEVELS = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
}

type LogMeta = Record<string, any>

class Logger {
  private minLevel: LogLevel

  constructor() {
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined
    this.minLevel = envLevel || LogLevel.INFO
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel]
  }

  private formatLog(
    level: LogLevel,
    message: string,
    meta?: LogMeta
  ): string {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      ...(meta && { meta }),
    }
    return JSON.stringify(logEntry)
  }

  debug(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatLog(LogLevel.DEBUG, message, meta))
    }
  }

  info(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatLog(LogLevel.INFO, message, meta))
    }
  }

  warn(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog(LogLevel.WARN, message, meta))
    }
  }

  error(message: string, meta?: LogMeta): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatLog(LogLevel.ERROR, message, meta))
    }
  }
}

export const logger = new Logger()
