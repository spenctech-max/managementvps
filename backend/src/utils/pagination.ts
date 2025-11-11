import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Pagination query parameters schema
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  limit: z.coerce
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
}).transform(data => ({
  page: data.page,
  limit: data.limit,
}));

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Parse and validate pagination query parameters
 * @param query - Express request query object
 * @returns Validated pagination parameters
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const result = paginationSchema.parse(query);
  return result;
}

/**
 * Build SQL LIMIT and OFFSET clause from pagination parameters
 * @param params - Pagination parameters
 * @returns Object with limit and offset values
 */
export function buildPaginationQuery(params: PaginationParams): { limit: number; offset: number } {
  const { page, limit } = params;
  const offset = (page - 1) * limit;

  return { limit, offset };
}

/**
 * Build pagination metadata from query results
 * @param params - Pagination parameters
 * @param totalCount - Total number of items (from COUNT query)
 * @returns Pagination metadata object
 */
export function buildPaginationMeta(
  params: PaginationParams,
  totalCount: number
): PaginationMeta {
  const { page, limit } = params;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Build complete paginated response
 * @param items - Array of data items
 * @param params - Pagination parameters
 * @param totalCount - Total number of items
 * @returns Complete paginated response object
 */
export function buildPaginatedResponse<T>(
  items: T[],
  params: PaginationParams,
  totalCount: number
): PaginatedResponse<T> {
  return {
    items,
    pagination: buildPaginationMeta(params, totalCount),
  };
}

/**
 * Validate pagination query parameters middleware
 */
export function validatePaginationParams(req: Request & { paginationParams?: PaginationParams }, res: Response, next: NextFunction) {
  try {
    req.paginationParams = parsePaginationParams(req.query as Record<string, unknown>);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pagination parameters',
      errors: error instanceof z.ZodError ? error.errors : [],
    });
  }
}
