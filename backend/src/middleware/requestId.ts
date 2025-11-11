import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware
 * Adds a unique ID to each request for tracing and correlation
 */

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  const requestId = uuidv4();

  // Attach to request object
  req.id = requestId;

  // Add to response headers for client-side debugging
  res.setHeader('X-Request-ID', requestId);

  next();
};
