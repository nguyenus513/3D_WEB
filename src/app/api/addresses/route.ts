/**
 * Secure Addresses API
 * All mutations go through this API with proper auth validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getProfileId } from '@/lib/utils/getProfileId';
import { debugLog } from '@/lib/utils/debugLog';
import { requireCsrf } from '@/lib/security/csrf';

// GET /api/addresses - List user's addresses
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getAdminSupabase();

        // SMART PROFILE LOOKUP: Try by ID first, then email fallback
        let profileId: string = session.user.id;

        const { data: profileById } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

        if (!profileById && session.user.email) {
            const { data: profileByEmail } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', session.user.email.toLowerCase())
                .single();

            if (profileByEmail) {
                profileId = profileByEmail.id;
            }
        }

        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('user_id', profileId)
            .order('is_default', { ascending: false });

        if (error) {
            console.error('Get addresses error:', error);
            return NextResponse.json({ error: 'Không thể tải địa chỉ' }, { status: 500 });
        }

        return NextResponse.json({ addresses: data });
    } catch (error) {
        console.error('Addresses API error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// POST /api/addresses - Create new address
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const body = await request.json();

        // Validate required fields (district is NOT NULL in schema v4)
        const { full_name, phone, address_line, province, district, is_default } = body;

        if (!full_name || !phone || !address_line || !province || !district) {
            return NextResponse.json({
                error: 'Thiếu thông tin bắt buộc',
                details: {
                    full_name: !full_name ? 'required' : 'ok',
                    phone: !phone ? 'required' : 'ok',
                    address_line: !address_line ? 'required' : 'ok',
                    province: !province ? 'required' : 'ok',
                    district: !district ? 'required' : 'ok',
                }
            }, { status: 400 });
        }

        // Validate phone format
        if (!/^[0-9+\-\s]{9,15}$/.test(phone)) {
            return NextResponse.json({ error: 'Số điện thoại không hợp lệ' }, { status: 400 });
        }

        const supabase = getAdminSupabase();

        // SMART PROFILE LOOKUP: Try by ID first, then email fallback
        let profileId: string = session.user.id;

        const { data: profileById } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

        if (!profileById) {
            debugLog('[POST /api/addresses] Profile not found by ID, trying email lookup');

            if (session.user.email) {
                const { data: profileByEmail } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', session.user.email.toLowerCase())
                    .single();

                if (profileByEmail) {
                    // Found by email - use that ID instead of corrupted session ID
                    debugLog('[POST /api/addresses] Using profile ID from email lookup:', profileByEmail.id);
                    profileId = profileByEmail.id;
                } else {
                    // Neither found - profile truly doesn't exist
                    console.error('[POST /api/addresses] Profile not found by ID or email:', session.user.id, session.user.email);
                    return NextResponse.json({
                        error: 'Hồ sơ không tìm thấy. Vui lòng đăng xuất và đăng nhập lại để tạo hồ sơ mới.',
                        code: 'PROFILE_NOT_FOUND'
                    }, { status: 400 });
                }
            } else {
                // No email in session - can't lookup
                return NextResponse.json({
                    error: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng xuất và đăng nhập lại.',
                    code: 'INVALID_SESSION'
                }, { status: 401 });
            }
        }

        // If setting as default, unset other defaults first
        if (is_default) {
            await supabase
                .from('addresses')
                .update({ is_default: false })
                .eq('user_id', profileId);
        }

        const { data, error } = await supabase
            .from('addresses')
            .insert({
                user_id: profileId,
                full_name: full_name.trim().slice(0, 100),
                phone: phone.trim().slice(0, 15),
                address_line: address_line.trim().slice(0, 255),
                ward: body.ward?.trim().slice(0, 50) || null,
                district: district.trim().slice(0, 50), // Required field
                province: province.trim().slice(0, 50),
                label: body.label?.trim().slice(0, 20) || 'Nhà',
                is_default: is_default || false,
            })
            .select()
            .single();

        if (error) {
            console.error('[POST /api/addresses] DB Error:', error);

            // Handle Foreign Key Violation (User profile missing)
            if (error.code === '23503') {
                return NextResponse.json({
                    error: 'Hồ sơ người dùng không tồn tại. Vui lòng đăng xuất và đăng nhập lại.',
                    code: error.code
                }, { status: 400 });
            }

            return NextResponse.json({
                error: 'Không thể thêm địa chỉ',
                code: error.code,
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({ address: data, success: true });
    } catch (error) {
        console.error('[POST /api/addresses] Exception:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// PUT /api/addresses - Update address
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID là bắt buộc' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const profileId = await getProfileId(session.user, supabase);

        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        // Verify ownership
        const { data: existing } = await supabase
            .from('addresses')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!existing || existing.user_id !== profileId) {
            return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
        }

        // If setting as default, unset others
        if (updates.is_default) {
            await supabase
                .from('addresses')
                .update({ is_default: false })
                .eq('user_id', profileId);
        }

        // Sanitize updates
        const sanitized: Record<string, unknown> = {};
        if (typeof updates.full_name === 'string' && updates.full_name.trim()) {
            sanitized.full_name = updates.full_name.trim().slice(0, 100);
        }
        if (typeof updates.phone === 'string' && updates.phone.trim()) {
            sanitized.phone = updates.phone.trim().slice(0, 15);
        }
        if (typeof updates.address_line === 'string' && updates.address_line.trim()) {
            sanitized.address_line = updates.address_line.trim().slice(0, 255);
        }
        if (updates.ward !== undefined) sanitized.ward = updates.ward?.trim().slice(0, 50) || null;
        if (typeof updates.district === 'string' && updates.district.trim()) {
            sanitized.district = updates.district.trim().slice(0, 50);
        }
        if (typeof updates.province === 'string' && updates.province.trim()) {
            sanitized.province = updates.province.trim().slice(0, 50);
        }
        if (typeof updates.label === 'string' && updates.label.trim()) {
            sanitized.label = updates.label.trim().slice(0, 20);
        }
        if (updates.is_default !== undefined) sanitized.is_default = updates.is_default;

        const { error } = await supabase
            .from('addresses')
            .update(sanitized)
            .eq('id', id);

        if (error) {
            console.error('Update address error:', error);
            return NextResponse.json({ error: 'Không thể cập nhật địa chỉ' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update address error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}

// DELETE /api/addresses - Delete address
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const csrf = await requireCsrf(request);
        if (!csrf.valid) {
            return csrf.error!;
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID là bắt buộc' }, { status: 400 });
        }

        const supabase = getAdminSupabase();
        const profileId = await getProfileId(session.user, supabase);

        if (!profileId) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 400 });
        }

        // Verify ownership
        const { data: existing } = await supabase
            .from('addresses')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!existing || existing.user_id !== profileId) {
            return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
        }

        const { error } = await supabase
            .from('addresses')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete address error:', error);
            return NextResponse.json({ error: 'Không thể xóa địa chỉ' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete address error:', error);
        return NextResponse.json({ error: 'Đã có lỗi xảy ra' }, { status: 500 });
    }
}
