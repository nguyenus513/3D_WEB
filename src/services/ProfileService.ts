/**
 * Profile Service
 *
 * Business logic layer for user profiles.
 */

import { ProfileRepository, Profile } from '@/repositories/ProfileRepository';
import { NotFoundError } from '@/lib/core/BaseController';
import { UpdateProfileInput } from '@/validators/profile.schema';

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
        email: string,
        input: UpdateProfileInput
    ): Promise<Profile> {
        const normalizedEmail = email.toLowerCase();

        // Check if profile exists
        const existing = await this.profileRepo.findByEmail(normalizedEmail);

        if (existing) {
            // Update existing profile
            return this.profileRepo.update(existing.id, {
                full_name: input.name,
                phone: input.phone,
                instagram: input.instagram,
            });
        } else {
            // Create new profile
            return this.profileRepo.create({
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
