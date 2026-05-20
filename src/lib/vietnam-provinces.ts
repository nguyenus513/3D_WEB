/**
 * Vietnam Provinces API Helper
 * Using open-api.vn for Vietnam geography data
 */

const API_BASE = '/api/geo';

export interface Province {
    code: number;
    name: string;
    codename: string;
    division_type: string;
    phone_code: number;
}

export interface District {
    code: number;
    name: string;
    codename: string;
    division_type: string;
    province_code: number;
}

export interface Ward {
    code: number;
    name: string;
    codename: string;
    division_type: string;
    district_code: number;
}

// Cache to avoid repeated API calls
let provincesCache: Province[] | null = null;
const districtsCache: Map<number, District[]> = new Map();
const wardsCache: Map<number, Ward[]> = new Map();

/**
 * Get all provinces/cities in Vietnam
 */
export async function getProvinces(): Promise<Province[]> {
    if (provincesCache) {
        return provincesCache;
    }

    try {
        const res = await fetch(`${API_BASE}/p/`);
        if (!res.ok) throw new Error('Failed to fetch provinces');

        const data = await res.json();
        provincesCache = data;
        return data;
    } catch (error) {
        console.error('Error fetching provinces:', error);
        return [];
    }
}

/**
 * Get districts of a province
 */
export async function getDistricts(provinceCode: number): Promise<District[]> {
    if (districtsCache.has(provinceCode)) {
        return districtsCache.get(provinceCode)!;
    }

    try {
        const res = await fetch(`${API_BASE}/p/${provinceCode}?depth=2`);
        if (!res.ok) throw new Error('Failed to fetch districts');

        const data = await res.json();
        const districts = data.districts || [];
        districtsCache.set(provinceCode, districts);
        return districts;
    } catch (error) {
        console.error('Error fetching districts:', error);
        return [];
    }
}

/**
 * Get wards of a district
 */
export async function getWards(districtCode: number): Promise<Ward[]> {
    if (wardsCache.has(districtCode)) {
        return wardsCache.get(districtCode)!;
    }

    try {
        const res = await fetch(`${API_BASE}/d/${districtCode}?depth=2`);
        if (!res.ok) throw new Error('Failed to fetch wards');

        const data = await res.json();
        const wards = data.wards || [];
        wardsCache.set(districtCode, wards);
        return wards;
    } catch (error) {
        console.error('Error fetching wards:', error);
        return [];
    }
}

/**
 * Format full address from parts
 */
export function formatAddress(
    addressLine: string,
    ward: string,
    district: string,
    province: string
): string {
    return [addressLine, ward, district, province]
        .filter(Boolean)
        .join(', ');
}


