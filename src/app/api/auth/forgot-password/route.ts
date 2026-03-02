/**
 * Forgot Password API Route
 *
 * Delegates all logic to AuthController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { authController } from '@/controllers/AuthController';

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
export async function POST(request: NextRequest) {
    return authController.forgotPassword(request);
}
