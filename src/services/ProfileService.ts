/**
 * Profile Service
 *
 * Business logic layer for user profiles.
 */

import { ProfileRepository, Profile } from '@/repositories/ProfileRepository';
import { NotFoundError } from '@/lib/core/BaseController';
import { UpdateProfileInput } from '@/validators/profile.schema';
import { debugLog } from '@/lib/utils/debugLog';

// =============================================================================
// Profile Service
// =============================================================================

export class ProfileService {
    constructor(private readonly profileRepo: ProfileRepository) { }

    /**
     * Get profile by email
     */
    async getProfileByEmail(email: string): Promise<Profile> {
        const profile = await this.profileRepo.findByEmail(email.toLowerCase());
        if (!profile) {
            throw new NotFoundError('Profile not found');
        }
        return profile;
    }

    /**
     * Update or create profile
     */
    async updateOrCreateProfile(
        userId: string,
        email: string,
        input: UpdateProfileInput
    ): Promise<Profile> {
        const normalizedEmail = email.toLowerCase();

        // Check if profile exists (by ID first, then email)
        // Ideally we should check by ID because that's the source of truth from Auth
        let existing = await this.profileRepo.findById(userId);

        if (!existing) {
            existing = await this.profileRepo.findByEmail(normalizedEmail);
        }

        if (existing) {
            // Update existing profile
            debugLog('[ProfileService] Updating existing profile:', existing.id);
            return this.profileRepo.update(existing.id, {
                full_name: input.name,
                phone: input.phone,
                instagram: input.instagram,
            });
        } else {
            // Create new profile with Auth ID
            debugLog('[ProfileService] Creating new profile for:', normalizedEmail, 'ID:', userId);
            return this.profileRepo.create({
                id: userId,
                email: normalizedEmail,
                full_name: input.name,
                phone: input.phone,
                instagram: input.instagram,
            });
        }
    }

    /**
     * Check if user is admin
     */
    async isAdmin(email: string): Promise<boolean> {
        const profile = await this.profileRepo.findByEmail(email.toLowerCase());
        return profile?.role === 'admin';
    }
}


