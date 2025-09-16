import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper for Express route handlers
 * Automatically catches async errors and passes them to error handling middleware
 */
export const handleAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Standard API response format for success cases
 */
export const sendSuccess = (res: Response, data: any, message?: string, statusCode: number = 200) => {
  return res.status(statusCode).json({
    success: true,
    message: message || 'Operation completed successfully',
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standard API response format for error cases
 */
export const sendError = (res: Response, error: string, statusCode: number = 400, details?: any) => {
  return res.status(statusCode).json({
    success: false,
    error,
    details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Pagination helper for consistent pagination responses
 */
export const sendPaginatedResponse = (
  res: Response, 
  data: any[], 
  page: number, 
  limit: number, 
  total: number,
  message?: string
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return res.json({
    success: true,
    message: message || 'Data retrieved successfully',
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null
    },
    timestamp: new Date().toISOString()
  });
};