import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found'));

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const apiError = error instanceof ApiError
    ? error
    : error instanceof ZodError
      ? new ApiError(400, 'VALIDATION_ERROR', error.issues.map(issue => issue.message).join(', '))
      : new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
  if (apiError.status >= 500) logger.error({ err: error, requestId: req.requestId }, 'request failed');
  res.status(apiError.status).json({ error: { code: apiError.code, message: apiError.message, requestId: req.requestId } });
};
