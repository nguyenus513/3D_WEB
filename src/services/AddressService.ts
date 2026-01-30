/**
 * Address Service
 *
 * Business logic layer for address management.
 * Handles validation and business rules for shipping addresses.
 *
 * @see backend-dev-guidelines.md - Rule #5: Use Service Layer for Business Logic
 */

import { AddressRepository, CreateAddressInput, UpdateAddressInput, Address } from '@/repositories/AddressRepository';
import { BadRequestError, NotFoundError } from '@/lib/core/BaseController';

// =============================================================================
// Constants
// =============================================================================

const MAX_ADDRESSES_PER_USER = 10;
const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;

// =============================================================================
// Address Service
// =============================================================================

export class AddressService {
    constructor(private readonly addressRepo: AddressRepository) { }

    /**
     * Get all addresses for a user
     */
    async getAddresses(userId: string): Promise<Address[]> {
        return this.addressRepo.findByUserId(userId);
    }

    /**
     * Get a single address (with ownership check)
     */
    async getAddress(addressId: string, userId: string): Promise<Address> {
        const address = await this.addressRepo.findByIdAndUserId(addressId, userId);
        if (!address) {
            throw new NotFoundError('Địa chỉ không tồn tại');
        }
        return address;
    }

    /**
     * Get user's default address
     */
    async getDefaultAddress(userId: string): Promise<Address | null> {
        return this.addressRepo.findDefaultByUserId(userId);
    }

    /**
     * Create a new address
     */
    async createAddress(userId: string, input: CreateAddressInput): Promise<Address> {
        // Validate input
        this.validateAddressInput(input);

        // Check address limit
        const count = await this.addressRepo.countByUserId(userId);
        if (count >= MAX_ADDRESSES_PER_USER) {
            throw new BadRequestError(`Bạn chỉ có thể lưu tối đa ${MAX_ADDRESSES_PER_USER} địa chỉ`);
        }

        // If this is the first address, make it default
        if (count === 0) {
            input.is_default = true;
        }

        return this.addressRepo.create(userId, input);
    }

    /**
     * Update an address
     */
    async updateAddress(addressId: string, userId: string, input: UpdateAddressInput): Promise<Address> {
        // Check ownership
        const existing = await this.addressRepo.findByIdAndUserId(addressId, userId);
        if (!existing) {
            throw new NotFoundError('Địa chỉ không tồn tại');
        }

        // Validate phone if provided
        if (input.phone) {
            this.validatePhone(input.phone);
        }

        return this.addressRepo.update(addressId, userId, input);
    }

    /**
     * Delete an address
     */
    async deleteAddress(addressId: string, userId: string): Promise<void> {
        // Check ownership
        const existing = await this.addressRepo.findByIdAndUserId(addressId, userId);
        if (!existing) {
            throw new NotFoundError('Địa chỉ không tồn tại');
        }

        await this.addressRepo.delete(addressId, userId);

        // If deleted address was default, set another as default
        if (existing.is_default) {
            const addresses = await this.addressRepo.findByUserId(userId);
            if (addresses.length > 0) {
                await this.addressRepo.setDefault(addresses[0].id, userId);
            }
        }
    }

    /**
     * Set an address as default
     */
    async setDefaultAddress(addressId: string, userId: string): Promise<Address> {
        // Check ownership
        const existing = await this.addressRepo.findByIdAndUserId(addressId, userId);
        if (!existing) {
            throw new NotFoundError('Địa chỉ không tồn tại');
        }

        return this.addressRepo.setDefault(addressId, userId);
    }

    // ==========================================================================
    // Private Helpers
    // ==========================================================================

    private validateAddressInput(input: CreateAddressInput): void {
        if (!input.full_name?.trim()) {
            throw new BadRequestError('Vui lòng nhập tên người nhận');
        }

        if (!input.phone?.trim()) {
            throw new BadRequestError('Vui lòng nhập số điện thoại');
        }

        this.validatePhone(input.phone);

        if (!input.address_line?.trim()) {
            throw new BadRequestError('Vui lòng nhập địa chỉ chi tiết');
        }

        if (!input.province?.trim()) {
            throw new BadRequestError('Vui lòng chọn Tỉnh/Thành phố');
        }
    }

    private validatePhone(phone: string): void {
        const cleanPhone = phone.replace(/\s/g, '');
        if (!PHONE_REGEX.test(cleanPhone)) {
            throw new BadRequestError('Số điện thoại không hợp lệ');
        }
    }
}
