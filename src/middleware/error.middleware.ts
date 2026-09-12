import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { RequestError } from '../utils/error';
import { errorResponse } from '../utils/response';

export const errorHandler: ErrorRequestHandler = (
    error: Error | RequestError,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Log error for debugging (in production, use proper logging service)
    console.log('Error occurred:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        timestamp: new Date().toISOString(),
    });
    // Handle syntax errors in JSON
    if (error instanceof SyntaxError && 'body' in error) {
        res.status(400).json(
            errorResponse('Invalid JSON in request body', 10002)
        );
        return;
    }

    // Handle any other unexpected errors
    res.status(500).json(
        errorResponse(
            process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message,
            10004
        )
    );
    // void return
};

// 404 Not Found handler
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json(
        errorResponse(`Route ${req.method} ${req.path} not found`, 10006)
    );
};
