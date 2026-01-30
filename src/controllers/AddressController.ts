/**
 * Address Controller
 *
 * API controller for address management endpoints.
 * Extends BaseController for standardized responses.
 *
 * @see backend-dev-guidelines.md - Rule #8: Route → Controller → Service
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { BaseController } from '@/lib/core/BaseController';
import { AddressService } from '@/services/AddressService';
import { AddressRepository } from '@/repositories/AddressRepository';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const createAddressSchema = z.object({
    label: z.string().optional().default('Nhà'),
    full_name: z.string().min(1, 'Vui lòng nhập tên người nhận'),
    phone: z.string().min(1, 'Vui lòng nhập số điện thoại'),
    address_line: z.string().min(1, 'Vui lòng nhập địa chỉ chi tiết'),
    ward: z.string().optional(),
    district: z.string().optional(),
    province: z.string().min(1, 'Vui lòng chọn Tỉnh/Thành phố'),
    is_default: z.boolean().optional().default(false),
});

const updateAddressSchema = z.object({
    label: z.string().optional(),
    full_name: z.string().optional(),
    phone: z.string().optional(),
    address_line: z.string().optional(),
    ward: z.string().optional(),
    district: z.string().optional(),
    province: z.string().optional(),
    is_default: z.boolean().optional(),
});

// =============================================================================
// Address Controller
// =============================================================================

export class AddressController extends BaseController {
    private service: AddressService | null = null;

    private async getService(): Promise<AddressService> {
        if (!this.service) {
            const supabase = await createServerSupabaseClient();
            const repo = new AddressRepository(supabase);
            this.service = new AddressService(repo);
        }
        return this.service;
    }

    /**
     * GET /api/addresses - Get all user addresses
     */
    async listAddresses(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            const addresses = await service.getAddresses(userId);
            return this.success(addresses);
        });
    }

    /**
     * GET /api/addresses/[id] - Get single address
     */
    async getAddress(req: NextRequest, addressId: string) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            const address = await service.getAddress(addressId, userId);
            return this.success(address);
        });
    }

    /**
     * GET /api/addresses/default - Get user's default address
     */
    async getDefaultAddress(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            const address = await service.getDefaultAddress(userId);
            return this.success(address);
        });
    }

    /**
     * POST /api/addresses - Create new address
     */
    async createAddress(req: NextRequest) {
        return this.handleRequest(req, async (userId) => {
            const body = await req.json();
            const validated = this.validate(createAddressSchema, body);

            const service = await this.getService();
            const address = await service.createAddress(userId, validated);
            return this.success(address, 201);
        });
    }

    /**
     * PUT /api/addresses/[id] - Update address
     */
    async updateAddress(req: NextRequest, addressId: string) {
        return this.handleRequest(req, async (userId) => {
            const body = await req.json();
            const validated = this.validate(updateAddressSchema, body);

            const service = await this.getService();
            const address = await service.updateAddress(addressId, userId, validated);
            return this.success(address);
        });
    }

    /**
     * DELETE /api/addresses/[id] - Delete address
     */
    async deleteAddress(req: NextRequest, addressId: string) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            await service.deleteAddress(addressId, userId);
            return this.success({ deleted: true });
        });
    }

    /**
     * PATCH /api/addresses/[id]/default - Set as default
     */
    async setDefaultAddress(req: NextRequest, addressId: string) {
        return this.handleRequest(req, async (userId) => {
            const service = await this.getService();
            const address = await service.setDefaultAddress(addressId, userId);
            return this.success(address);
        });
    }
}
