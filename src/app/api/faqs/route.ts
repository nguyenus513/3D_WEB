import { NextResponse } from 'next/server';
import { getMongoCollection } from '@/lib/mongodb';

export async function GET() {
    try {
        const faqs = await (await getMongoCollection('faqs'))
            .find({ is_active: { $ne: false } })
            .sort({ sort_order: 1, created_at: 1 })
            .toArray();

        return NextResponse.json({
            faqs: faqs.map(({ _id, ...faq }) => ({ id: String(_id), ...faq })),
        });
    } catch (error) {
        console.error('[FAQ API] Error:', error);
        return NextResponse.json({ faqs: [] }, { status: 200 });
    }
}
