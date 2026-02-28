import { ApiError } from "./types"

export class BaseError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.details = details
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', details)
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details)
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', details)
  }
}

export class IntegrationError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INTEGRATION_ERROR', details)
  }
}

// Helper function to determine if an error is one of our custom errors
export const isCustomError = (error: unknown): error is BaseError => {
  return error instanceof BaseError
}

// Helper function to format error for API response
export const formatError = (error: unknown): ApiError => {
  if (isCustomError(error)) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    }
  }

  // Handle unknown errors
  return {
    message: error instanceof Error ? error.message : 'An unknown error occurred',
    code: 'INTERNAL_ERROR'
  }
}