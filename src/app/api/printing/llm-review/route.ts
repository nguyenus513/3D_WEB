import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isRateLimited, rateLimitedResponse } from '@/lib/security';
import { requestPrintLlmReview, type PrintLlmReviewRequest } from '@/lib/printing/llm-review';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = isRateLimited(request);
        if (rateLimit.limited) return rateLimitedResponse(rateLimit.resetIn);

        const payload = await request.json() as PrintLlmReviewRequest;
        if (!payload.contextId || !payload.fileName || !payload.printType) {
            return NextResponse.json({ error: 'Missing review context' }, { status: 400 });
        }

        const review = await requestPrintLlmReview(payload);

        return NextResponse.json({
            status: review.status,
            contextId: payload.contextId,
            error: review.error,
            result: review.result,
        });
    } catch (error) {
        console.error('[printing/llm-review]', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'LLM review failed' }, { status: 500 });
    }
}
