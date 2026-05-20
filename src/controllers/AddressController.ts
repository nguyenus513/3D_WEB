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
import { BaseController, UnauthorizedError } from '@/lib/core/BaseController';
import { AddressService } from '@/services/AddressService';
import { AddressRepository } from '@/repositories/AddressRepository';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';

// Admin client for address operations
const supabaseAdmin = getAdminSupabase();

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
    private readonly addressService: AddressService;

    constructor() {
        super();
        const repo = new AddressRepository(supabaseAdmin);
        this.addressService = new AddressService(repo);
    }

    /**
     * GET /api/addresses - Get all user addresses
     */
    async listAddresses(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const addresses = await this.addressService.getAddresses(session.user.id);
            return this.handleSuccess({ addresses });
        }, 'AddressController.listAddresses');
    }

    /**
     * GET /api/addresses/[id] - Get single address
     */
    async getAddress(req: NextRequest, addressId: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const address = await this.addressService.getAddress(addressId, session.user.id);
            return this.handleSuccess(address);
        }, 'AddressController.getAddress');
    }

    /**
     * GET /api/addresses/default - Get user's default address
     */
    async getDefaultAddress(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const address = await this.addressService.getDefaultAddress(session.user.id);
            return this.handleSuccess(address);
        }, 'AddressController.getDefaultAddress');
    }

    /**
     * POST /api/addresses - Create new address
     */
    async createAddress(req: NextRequest) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const body = await req.json();
            const validated = createAddressSchema.parse(body);

            const address = await this.addressService.createAddress(session.user.id, validated);
            return this.handleSuccess(address, { status: 201 });
        }, 'AddressController.createAddress');
    }

    /**
     * PUT /api/addresses/[id] - Update address
     */
    async updateAddress(req: NextRequest, addressId: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const body = await req.json();
            const validated = updateAddressSchema.parse(body);

            const address = await this.addressService.updateAddress(addressId, session.user.id, validated);
            return this.handleSuccess(address);
        }, 'AddressController.updateAddress');
    }

    /**
     * DELETE /api/addresses/[id] - Delete address
     */
    async deleteAddress(req: NextRequest, addressId: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            await this.addressService.deleteAddress(addressId, session.user.id);
            return this.handleSuccess({ deleted: true });
        }, 'AddressController.deleteAddress');
    }

    /**
     * PATCH /api/addresses/[id]/default - Set as default
     */
    async setDefaultAddress(req: NextRequest, addressId: string) {
        return this.wrapHandler(async () => {
            const session = await auth();
            if (!session?.user?.id) {
                throw new UnauthorizedError();
            }

            const address = await this.addressService.setDefaultAddress(addressId, session.user.id);
            return this.handleSuccess(address);
        }, 'AddressController.setDefaultAddress');
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const addressController = new AddressController();

