/**
 * Standardized API Response Types
 * Provides consistent response structure across all endpoints
 */

import { Response } from 'express';

/**
 * Base response interface
 */
export interface BaseResponse {
  success: boolean;
  message?: string;
}

/**
 * Success response with data
 */
export interface SuccessResponse<T = unknown> extends BaseResponse {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

/**
 * Error response
 */
export interface ErrorResponse extends BaseResponse {
  success: false;
  error: {
    code?: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T = unknown> extends SuccessResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Helper function to send success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: Record<string, unknown>
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    ...(meta && { meta }),
  };

  res.status(statusCode).json(response);
}

/**
 * Helper function to send paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  message?: string
): void {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const response: PaginatedResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
  };

  res.status(200).json(response);
}

/**
 * Helper function to send error response
 * Note: This should rarely be used directly - prefer throwing custom errors
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: Record<string, unknown>
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Helper function to send created response (201)
 */
export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message || 'Resource created successfully', 201);
}

/**
 * Helper function to send no content response (204)
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Helper function to send accepted response (202)
 */
export function sendAccepted<T>(res: Response, data?: T, message?: string): void {
  if (data) {
    sendSuccess(res, data, message || 'Request accepted for processing', 202);
  } else {
    res.status(202).json({
      success: true,
      message: message || 'Request accepted for processing',
    });
  }
}
