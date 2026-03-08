import { NextResponse } from 'next/server';

export class ApiError extends Error {
    public statusCode: number;
    public code: string;

    constructor(message: string, statusCode: number, code: string) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

interface ErrorResponseBody {
    error: string;
    code: string;
    details?: string;
}

export function handleApiError(error: unknown): NextResponse<ErrorResponseBody> {
    if (error instanceof ApiError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
        );
    }

    if (error instanceof Error) {
        return NextResponse.json(
            {
                error: 'Đã xảy ra lỗi máy chủ',
                code: 'INTERNAL_SERVER_ERROR',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { error: 'Đã xảy ra lỗi không xác định', code: 'UNKNOWN_ERROR' },
        { status: 500 }
    );
}

export function badRequest(message = 'Yêu cầu không hợp lệ'): ApiError {
    return new ApiError(message, 400, 'BAD_REQUEST');
}

export function unauthorized(message = 'Chưa xác thực'): ApiError {
    return new ApiError(message, 401, 'UNAUTHORIZED');
}

export function forbidden(message = 'Không có quyền truy cập'): ApiError {
    return new ApiError(message, 403, 'FORBIDDEN');
}

export function notFound(message = 'Không tìm thấy tài nguyên'): ApiError {
    return new ApiError(message, 404, 'NOT_FOUND');
}

export function serverError(message = 'Lỗi máy chủ nội bộ'): ApiError {
    return new ApiError(message, 500, 'INTERNAL_SERVER_ERROR');
}
