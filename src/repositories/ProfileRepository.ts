/**
 * Profile Repository
 *
 * MongoDB data access layer for profiles.
 */

import { getMongoCollections } from '@/lib/mongodb';
import type { ProfileDocument } from '@/lib/mongodb';

export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    customer_code: string | null;
    role: 'customer' | 'admin';
    created_at: string;
    updated_at: string | null;
}

function toProfile(row: ProfileDocument): Profile {
    return {
        id: row._id,
        email: row.email || '',
        full_name: row.full_name || null,
        phone: row.phone || null,
        customer_code: row.customer_code || null,
        role: (row.role || 'customer') as 'customer' | 'admin',
        created_at: (row.created_at || new Date()).toISOString(),
        updated_at: row.updated_at?.toISOString() || null,
    };
}

export class ProfileRepository {
    constructor(_legacyClient?: unknown) { }

    async findByEmail(email: string): Promise<Profile | null> {
        const { profiles } = await getMongoCollections();
        const data = await profiles.findOne({ email: email.toLowerCase() });
        return data ? toProfile(data) : null;
    }

    async findById(id: string): Promise<Profile | null> {
        const { profiles } = await getMongoCollections();
        const data = await profiles.findOne({ _id: id });
        return data ? toProfile(data) : null;
    }

    async create(input: {
        id: string;
        email: string;
        full_name?: string | null;
        phone?: string | null;
    }): Promise<Profile> {
        const { profiles } = await getMongoCollections();
        const now = new Date();
        const customerCode = 'USR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const document: ProfileDocument = {
            _id: input.id,
            email: input.email.toLowerCase(),
            full_name: input.full_name ?? null,
            phone: input.phone ?? null,
            customer_code: customerCode,
            role: 'customer',
            created_at: now,
            updated_at: now,
        };

        await profiles.insertOne(document);
        return toProfile(document);
    }

    async update(
        id: string,
        input: {
            full_name?: string | null;
            phone?: string | null;
        }
    ): Promise<Profile> {
        const { profiles } = await getMongoCollections();
        const $set: Partial<ProfileDocument> = { updated_at: new Date() };

        if (input.full_name !== undefined) $set.full_name = input.full_name;
        if (input.phone !== undefined) $set.phone = input.phone;

        const result = await profiles.findOneAndUpdate(
            { _id: id },
            { $set },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new Error('Profile not found');
        }

        return toProfile(result);
    }
}

