/**
 * Profile Controller
 *
 * Request handling layer for profile API.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/auth';
import { BaseController, UnauthorizedError } from '@/lib/core/BaseController';
import { ProfileService } from '@/services/ProfileService';
import { ProfileRepository } from '@/repositories/ProfileRepository';
import { UpdateProfileSchema } from '@/validators/profile.schema';
import { config } from '@/config/unifiedConfig';

// =============================================================================
// Profile Controller
// =============================================================================

export class ProfileController extends BaseController {
    private _supabase: ReturnType<typeof createClient> | null = null;
    private readonly profileService: ProfileService;

    /**
     * Lazy initialize Supabase Admin Client
     * Prevents startup crashes if env vars are missing during build/init
     */
    private get supabase() {
        if (!this._supabase) {
            this._supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey,
                { auth: { persistSession: false } }
            );
        }
        return this._supabase;
    }

    constructor() {
        super();
        // Initialize repository and service with getter reference
        const profileRepo = new ProfileRepository(this.supabase);
        this.profileService = new ProfileService(profileRepo);
    }

    /**
     * GET /api/profile
     * Get current user's profile
     */
    async getProfile() {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.email || !session?.user?.id) {
                throw new UnauthorizedError();
            }

            try {
                const profile = await this.profileService.getProfileByEmail(
                    session.user.email
                );
                return this.handleSuccess(profile);
            } catch (error) {
                console.error('[ProfileController.getProfile] Error:', error);
                throw error;
            }
        }, 'ProfileController.getProfile');
    }

    /**
     * PUT /api/profile
     * Update or create current user's profile
     */
    async updateProfile(request: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.email || !session?.user?.id) {
                throw new UnauthorizedError();
            }

            try {
                // Parse and validate input
                const body = await request.json();
                const input = UpdateProfileSchema.parse(body);

                // Update or create profile
                const profile = await this.profileService.updateOrCreateProfile(
                    session.user.id,
                    session.user.email,
                    input
                );

                return this.handleSuccess(profile);
            } catch (error) {
                console.error('[ProfileController.updateProfile] Error:', error);
                throw error;
            }
        }, 'ProfileController.updateProfile');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const profileController = new ProfileController();
