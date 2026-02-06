/**
 * Profile API Route
 *
 * Delegates all logic to ProfileController.
 *
 * @see DEVELOPMENT_GUIDE.md - Rule #1: Routes Only Route
 */

import { NextRequest } from 'next/server';
import { profileController } from '@/controllers/ProfileController';

/**
 * GET /api/profile
 * Get current user's profile
 */
export async function GET() {
    return profileController.getProfile();
}

/**
 * PUT /api/profile
 * Update or create profile
 */
export async function PUT(request: NextRequest) {
    return profileController.updateProfile(request);
}

