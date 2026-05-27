/**
 * Auth Repository
 *
 * MongoDB data access layer for auth-related collections.
 */

import crypto from 'crypto';
import { getMongoCollections, getMongoCollection } from '@/lib/mongodb';

export interface VerificationToken {
    identifier: string;
    token: string;
    expires: Date;
}

export interface PasswordResetToken {
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
}

export class AuthRepository {
    async createUser(data: {
        email: string;
        hashedPassword: string;
        name?: string;
        phone?: string;
    }): Promise<{ id: string; customer_code: string }> {
        const { profiles } = await getMongoCollections();
        const userId = crypto.randomUUID();
        const customerCode = 'KH-' + crypto.randomUUID().substring(0, 8).toUpperCase();
        const now = new Date();

        await profiles.insertOne({
            _id: userId,
            email: data.email.toLowerCase(),
            full_name: data.name || null,
            phone: data.phone || null,
            password: data.hashedPassword,
            customer_code: customerCode,
            role: 'customer',
            email_verified: false,
            created_at: now,
            updated_at: now,
        });

        return { id: userId, customer_code: customerCode };
    }

    async emailExists(email: string): Promise<boolean> {
        const { profiles } = await getMongoCollections();
        return !!(await profiles.findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } }));
    }

    async getUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
        const { profiles } = await getMongoCollections();
        const user = await profiles.findOne({ email: email.toLowerCase() }, { projection: { _id: 1, email: 1 } });
        return user ? { id: user._id, email: user.email || email.toLowerCase() } : null;
    }

    async createAddress(userId: string, address: {
        full_name?: string;
        phone?: string;
        address_line?: string;
        ward?: string;
        district?: string;
        province?: string;
    }): Promise<void> {
        try {
            const { addresses } = await getMongoCollections();
            await addresses.insertOne({
                _id: crypto.randomUUID(),
                user_id: userId,
                label: 'Nhà',
                full_name: address.full_name || '',
                phone: address.phone || '',
                address_line: address.address_line || '',
                ward: address.ward || null,
                district: address.district || null,
                province: address.province || '',
                is_default: true,
                created_at: new Date(),
            });
        } catch (error) {
            console.error('[AuthRepository.createAddress] Failed to save address:', error);
        }
    }

    async saveVerificationToken(email: string, otp: string, expiresAt: Date): Promise<void> {
        const verificationTokens = await getMongoCollection<VerificationToken & { _id: string }>('verification_tokens');
        await verificationTokens.insertOne({
            _id: crypto.randomUUID(),
            identifier: email.toLowerCase(),
            token: otp,
            expires: expiresAt,
        });
    }

    async verifyOtp(email: string, otp: string): Promise<boolean> {
        const verificationTokens = await getMongoCollection<VerificationToken & { _id: string }>('verification_tokens');
        const token = await verificationTokens.findOne({
            identifier: email.toLowerCase(),
            token: otp,
            expires: { $gt: new Date() },
        });

        if (!token) return false;

        await verificationTokens.deleteOne({ _id: token._id });
        return true;
    }

    async markEmailVerified(email: string): Promise<void> {
        const { profiles } = await getMongoCollections();
        await profiles.updateOne(
            { email: email.toLowerCase() },
            { $set: { email_verified: true, updated_at: new Date() } }
        );
    }

    async saveResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        const passwordResetTokens = await getMongoCollection<PasswordResetToken & { _id: string }>('password_reset_tokens');
        await passwordResetTokens.updateOne(
            { user_id: userId },
            {
                $set: {
                    token_hash: tokenHash,
                    expires_at: expiresAt,
                    created_at: new Date(),
                },
                $setOnInsert: { _id: userId },
            },
            { upsert: true }
        );
    }

    async verifyResetToken(tokenHash: string): Promise<string | null> {
        const passwordResetTokens = await getMongoCollection<PasswordResetToken & { _id: string }>('password_reset_tokens');
        const token = await passwordResetTokens.findOne({
            token_hash: tokenHash,
            expires_at: { $gt: new Date() },
        });

        return token?.user_id || null;
    }

    async updatePassword(userId: string, hashedPassword: string): Promise<void> {
        const { profiles } = await getMongoCollections();
        const passwordResetTokens = await getMongoCollection<PasswordResetToken & { _id: string }>('password_reset_tokens');

        await profiles.updateOne(
            { _id: userId },
            { $set: { password: hashedPassword, updated_at: new Date() } }
        );
        await passwordResetTokens.deleteMany({ user_id: userId });
    }
}
