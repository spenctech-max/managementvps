import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { AppError, NotFoundError } from '../errors';

// Re-export for convenience
export { AppError, NotFoundError };

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isDevelopment = isDevelopmentMode();

  if (err instanceof AppError) {
    // Operational error - log details server-side
    logger.error('Operational error:', {
      requestId: req.id,
      message: err.message,
      statusCode: err.statusCode,
      errorName: err.name,
      path: req.path,
      method: req.method,
      details: err.details,
      stack: isDevelopment ? err.stack : undefined,
    });

    // Sanitize message for client response
    const sanitizedMessage = sanitizeErrorMessage(err.message, isDevelopment);

    res.status(err.statusCode).json({
      success: false,
      message: sanitizedMessage,
      ...(err.details && isDevelopment && { details: err.details }),
      // NEVER expose stack traces in production, even if NODE_ENV is misconfigured
      ...(isDevelopment && { stack: err.stack }),
    });
    return;
  }

  // Programming or unknown error - log full details server-side
  logger.error('Unexpected error:', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: err.stack,
    // Log additional context
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Sanitize message for client response
  const sanitizedMessage = isDevelopment
    ? err.message
    : sanitizeErrorMessage(err.message, isDevelopment);

  res.status(500).json({
    success: false,
    message: sanitizedMessage || 'An unexpected error occurred',
    // NEVER expose stack traces in production, even if NODE_ENV is misconfigured
    ...(isDevelopment && { stack: err.stack }),
  });
};

/**
 * Async handler wrapper - catches errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const isDevelopment = isDevelopmentMode();
  // In production, don't expose the full URL to avoid leaking query parameters
  const errorMessage = isDevelopment
    ? `Route not found: ${req.originalUrl}`
    : 'Route not found';
  const error = new NotFoundError('Route', errorMessage);
  next(error);
};

/**
 * Determine if we're in development mode
 * Uses multiple checks to ensure we don't accidentally expose info in production
 */
function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Sanitize error message - remove sensitive information
 */
export function sanitizeErrorMessage(message: string, isDevelopment: boolean = false): string {
  // In development mode, return the original message
  if (isDevelopment) {
    return message;
  }

  // Remove IP addresses
  message = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP_REDACTED]');

  // Remove ports
  message = message.replace(/:\d{2,5}\b/g, ':[PORT]');

  // Remove file paths (Unix-style)
  message = message.replace(/\/[\w\/.-]+/g, '[PATH]');

  // Remove file paths (Windows-style)
  message = message.replace(/[A-Z]:\\[\w\\.-]+/gi, '[PATH]');

  // Remove hostnames and domains
  message = message.replace(/\b[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,6}\b/gi, '[HOSTNAME]');

  // Remove common sensitive patterns
  message = message
    .replace(/password[=:]\s*['"]?[^'"&\s]+['"]?/gi, 'password=***')
    .replace(/token[=:]\s*['"]?[^'"&\s]+['"]?/gi, 'token=***')
    .replace(/key[=:]\s*['"]?[^'"&\s]+['"]?/gi, 'key=***')
    .replace(/secret[=:]\s*['"]?[^'"&\s]+['"]?/gi, 'secret=***');

  // Generic SSH errors
  if (message.toLowerCase().includes('ssh') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('EHOSTUNREACH')) {
    return 'Connection failed. Please check your server configuration.';
  }

  // Generic database errors
  if (message.toLowerCase().includes('database') ||
      message.toLowerCase().includes('postgres') ||
      message.toLowerCase().includes('sql') ||
      message.toLowerCase().includes('query') ||
      message.toLowerCase().includes('relation') ||
      message.toLowerCase().includes('column')) {
    return 'A database error occurred. Please try again.';
  }

  // Generic authentication errors
  if (message.toLowerCase().includes('authentication') ||
      message.toLowerCase().includes('auth') ||
      message.toLowerCase().includes('credentials') ||
      message.toLowerCase().includes('unauthorized')) {
    return 'Authentication failed. Please check your credentials.';
  }

  // Generic permission errors
  if (message.toLowerCase().includes('permission') ||
      message.toLowerCase().includes('access denied') ||
      message.toLowerCase().includes('forbidden')) {
    return 'Access denied. You do not have permission to perform this action.';
  }

  // Generic network errors
  if (message.toLowerCase().includes('network') ||
      message.toLowerCase().includes('connect') ||
      message.toLowerCase().includes('timeout')) {
    return 'Network error occurred. Please try again.';
  }

  // Generic file system errors
  if (message.toLowerCase().includes('enoent') ||
      message.toLowerCase().includes('file not found') ||
      message.toLowerCase().includes('eacces')) {
    return 'Resource not found or inaccessible.';
  }

  // If we still have a detailed technical message, replace it
  if (message.length > 100 || /[A-Z][a-z]+Error/.test(message)) {
    return 'An error occurred. Please try again.';
  }

  return message;
}
