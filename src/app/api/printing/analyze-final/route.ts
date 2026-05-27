import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/auth';
import { isRateLimited, rateLimitedResponse } from '@/lib/security';
import { requestPrintLlmReview } from '@/lib/printing/llm-review';
import { sliceModel } from '@/lib/slicer/slicerRunner';
import { calculateFdmPrice, calculateResinPrice } from '@/lib/slicer/priceEngine';
import type { FdmSlicerResult, ResinSlicerResult, SliceJobParams } from '@/lib/slicer/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.stl', '.obj', '.3mf']);

async function callExternalSlicer(file: File, params: SliceJobParams) {
    const workerUrl = process.env.SLICER_WORKER_URL;
    if (!workerUrl) return null;

    const form = new FormData();
    form.append('file', file);
    form.append('mode', params.mode);
    form.append('profileId', params.profileId);
    form.append('layerHeight', '0.2');
    form.append('infill', '20');
    form.append('support', String(params.support));
    form.append('quantity', '1');

    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/slice-analyze`, {
        method: 'POST',
        headers: process.env.SLICER_WORKER_SECRET ? { authorization: `Bearer ${process.env.SLICER_WORKER_SECRET}` } : undefined,
        body: form,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body?.error || `Slicer worker HTTP ${response.status}`);
    }
    return body;
}

async function runLocalSlicerFallback(file: File, params: SliceJobParams) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const slicerResult = await sliceModel(buffer, file.name, { ...params, layerHeight: 0.2, infill: 20, quantity: 1 });
    const price = slicerResult.mode === 'fdm'
        ? calculateFdmPrice(slicerResult as FdmSlicerResult, params.quantity, params.layerHeight, params.infill).total
        : calculateResinPrice(slicerResult as ResinSlicerResult, params.quantity).total;
    return { ...slicerResult, price, source: 'local_prusaslicer' };
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateCheck = isRateLimited(request);
        if (rateCheck.limited) return rateLimitedResponse(rateCheck.resetIn);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const mode = ((formData.get('type') || formData.get('mode') || 'fdm') as string) === 'resin' ? 'resin' : 'fdm';
        const layerHeight = parseFloat(String(formData.get('layerHeight') || '0.2'));
        const infillRaw = String(formData.get('infill') || '20').replace('%', '');
        const infill = parseInt(infillRaw) || 20;
        const support = String(formData.get('support') || 'true') !== 'false';
        const quantity = parseInt(String(formData.get('quantity') || '1')) || 1;
        const profileId = String(formData.get('profileId') || (mode === 'resin' ? 'resin_standard_detail' : 'fdm_petg_standard'));

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'File qua lon. Toi da 50MB.' }, { status: 400 });

        const lowerName = file.name.toLowerCase();
        const ext = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return NextResponse.json({ error: 'Dinh dang khong ho tro. Vui long upload STL, OBJ hoac 3MF.' }, { status: 400 });
        }

        const contextId = `slicer_${randomUUID()}`;
        const params: SliceJobParams = { mode, profileId, layerHeight, infill, support, quantity };

        let slicer: unknown;
        const webErrors: string[] = [];
        try {
            slicer = await callExternalSlicer(file, params);
            if (!slicer) slicer = await runLocalSlicerFallback(file, params);
        } catch (error) {
            webErrors.push(error instanceof Error ? error.message : String(error));
            slicer = { status: 'failed', error: webErrors[0], source: process.env.SLICER_WORKER_URL ? 'slicer_worker' : 'local_prusaslicer' };
        }

        const llm = await requestPrintLlmReview({
            contextId,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || ext,
            printType: mode,
            infill: `${infill}%`,
            layerHeight: String(layerHeight),
            slicer,
            webErrors,
        });

        return NextResponse.json({
            contextId,
            status: 'final',
            analysisSource: 'slicer_first_llm_final',
            slicer,
            llm,
            hasProblem: llm.result.hasProblem,
            customerMessage: llm.result.customerMessage,
            adminNotes: llm.result.adminNotes,
            fixSuggestions: llm.result.fixSuggestions,
            confidence: llm.result.confidence,
        });
    } catch (error) {
        console.error('[printing/analyze-final]', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Analyze final failed' }, { status: 500 });
    }
}
