import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/auth';
import { isRateLimited, rateLimitedResponse } from '@/lib/security';
import { buildCacheKey, getCached, setCached } from '@/lib/slicer/slicerCache';
import { createJob, createCompletedJob, enqueue } from '@/lib/slicer/jobQueue';
import { sliceModel } from '@/lib/slicer/slicerRunner';
import { calculateFdmPrice, calculateResinPrice } from '@/lib/slicer/priceEngine';
import type { SliceJobParams, FdmSlicerResult, ResinSlicerResult, QuoteResult } from '@/lib/slicer/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.3mf']);

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateCheck = isRateLimited(request);
        if (rateCheck.limited) return rateLimitedResponse(rateCheck.resetIn);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const mode = (formData.get('mode') as string) || 'fdm';
        const profileId = (formData.get('profileId') as string) || (mode === 'resin' ? 'resin_standard_detail' : 'fdm_petg_standard');
        const layerHeight = parseFloat((formData.get('layerHeight') as string) || '0.2');
        const infill = parseInt((formData.get('infill') as string) || '20');
        const support = (formData.get('support') as string) !== 'false';
        const quantity = parseInt((formData.get('quantity') as string) || '1');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileName = file.name.toLowerCase();
        const ext = fileName.slice(fileName.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return NextResponse.json(
                { error: `Định dạng file không được hỗ trợ. Vui lòng upload file .3mf.` },
                { status: 400 },
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File quá lớn. Tối đa 50MB cho báo giá tự động.' },
                { status: 400 },
            );
        }

        const params: SliceJobParams = {
            mode: mode as 'fdm' | 'resin',
            profileId,
            layerHeight,
            infill,
            support,
            quantity,
        };

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const cacheKey = buildCacheKey(fileBuffer, params);
        const cached = getCached(cacheKey);

        if (cached) {
            return NextResponse.json({
                status: 'completed',
                result: { ...cached, source: 'cache' },
                cached: true,
            });
        }

        const jobId = randomUUID();
        createJob(jobId);

        enqueue(jobId, async (): Promise<QuoteResult> => {
            const slicerResult = await sliceModel(fileBuffer, file.name, { ...params, layerHeight: 0.2, infill: 20, quantity: 1 });
            let price: number;

            if (slicerResult.mode === 'fdm') {
                const breakdown = calculateFdmPrice(slicerResult as FdmSlicerResult, quantity, params.layerHeight, params.infill);
                price = breakdown.total;
            } else {
                const breakdown = calculateResinPrice(slicerResult as ResinSlicerResult, quantity);
                price = breakdown.total;
            }

            const quoteResult: QuoteResult = { ...slicerResult, price };
            setCached(cacheKey, quoteResult);
            return quoteResult;
        });

        return NextResponse.json({ jobId, status: 'pending' });
    } catch (err) {
        console.error('[ExactQuote] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
