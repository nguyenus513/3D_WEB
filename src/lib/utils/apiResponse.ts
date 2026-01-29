/**
 * API Error Types and Response Helpers
 */

export type ErrorCode =
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'ORDER_CREATE_FAILED'
    | 'PAYMENT_FAILED'
    | 'DUPLICATE_REQUEST'
    | 'INSUFFICIENT_STOCK'
    | 'NOT_FOUND'
    | 'INTERNAL_ERROR';

export interface ApiError {
    code: ErrorCode;
    message: string;
    details?: {
        correlationId?: string;
        reason?: string;
        field?: string;
        [key: string]: unknown;
    };
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
    code: ErrorCode,
    message: string,
    details?: ApiError['details']
): ApiResponse {
    return {
        success: false,
        error: { code, message, details },
    };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
    };
}

/**
 * Error messages in Vietnamese
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    VALIDATION_ERROR: 'Dữ liệu không hợp lệ',
    UNAUTHORIZED: 'Vui lòng đăng nhập để tiếp tục',
    ORDER_CREATE_FAILED: 'Không thể tạo đơn hàng. Vui lòng thử lại sau.',
    PAYMENT_FAILED: 'Thanh toán thất bại. Vui lòng thử lại.',
    DUPLICATE_REQUEST: 'Yêu cầu đã được xử lý trước đó.',
    INSUFFICIENT_STOCK: 'Sản phẩm không đủ số lượng trong kho.',
    NOT_FOUND: 'Không tìm thấy dữ liệu.',
    INTERNAL_ERROR: 'Đã xảy ra lỗi. Vui lòng thử lại sau.',
};
