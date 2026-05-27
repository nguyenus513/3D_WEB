export interface PrintLlmReviewRequest {
    contextId: string;
    fileName: string;
    fileSize: number;
    fileType?: string;
    printType: 'fdm' | 'resin';
    infill?: string;
    layerHeight?: string;
    color?: string;
    slicer?: unknown;
    evidence?: unknown;
    webErrors?: string[];
}

export interface PrintLlmReviewResult {
    hasProblem: boolean;
    confidence: number;
    verdict: 'good' | 'warning' | 'failed';
    message: string;
    details: string[];
    fixes: string[];
    problemSummary: string;
    fixSuggestions: string[];
    adminNotes: string;
    customerMessage: string;
}

type JsonMap = Record<string, unknown>;

const GOOD_MESSAGE = 'Tốt. Có thể in ngay.';
const FAILED_MESSAGE = 'Không tính được thể tích file.';
const WARNING_MESSAGE = 'Có điểm cần kiểm tra trước khi in.';

export const EMPTY_PRINT_LLM_REVIEW: PrintLlmReviewResult = {
    hasProblem: false,
    confidence: 0,
    verdict: 'good',
    message: GOOD_MESSAGE,
    details: [],
    fixes: [],
    problemSummary: '',
    fixSuggestions: [],
    adminNotes: '',
    customerMessage: '',
};

function safeJsonParse(text: string): JsonMap {
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return {};
        try {
            return JSON.parse(match[0]);
        } catch {
            return {};
        }
    }
}

function asMap(value: unknown): JsonMap {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonMap : {};
}

function num(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function ext(fileName: string) {
    return fileName.toLowerCase().split('.').pop() || '';
}

function list(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function clean(value: unknown, maxLength: number) {
    return String(value || '')
        .replace(/mở slicer thật/gi, 'xuất lại file mesh hợp lệ')
        .replace(/slicer thật/gi, 'hệ thống kiểm tra file')
        .replace(/mở slicer/gi, 'kiểm tra lại file')
        .replace(/báo giá thủ công/gi, 'tải lại file hợp lệ')
        .replace(/score\s*\d+\s*\/\s*\d+/gi, '')
        .replace(/confidence\s*\d+\s*%\.?/gi, '')
        .replace(/File đọc được[^.?]*[.?]/gi, '')
        .replace(/Hệ thống đã tính giá[^.?]*[.?]/gi, '')
        .replace(/không có cảnh báo rõ ràng[^.?]*[.?]/gi, '')
        .replace(/dựa trên thể tích[^.?]*[.?]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function fallbackDetails(context: JsonMap) {
    const slicer = asMap(context.slicer);
    const warnings = list(slicer.warnings).map((item) => clean(asMap(item).message, 220)).filter(Boolean);
    const failureReason = clean(slicer.failureReason || list(context.webErrors)[0], 220);
    const details = [...warnings];
    if (failureReason) details.push(failureReason);
    if (num(slicer.openBoundaryEdgeCount) > 0) details.push('Mesh có cạnh hở nên thể tích có thể không kín hoặc khó in ổn định.');
    if (num(slicer.nonManifoldEdgeCount) > 0) details.push('Mesh có cạnh non-manifold, cần làm sạch topology trước khi in.');
    if (!details.length) details.push('File có dữ liệu chưa đủ ổn định để hệ thống xác nhận in ngay.');
    return Array.from(new Set(details)).slice(0, 4);
}

function fallbackFixes(context: JsonMap) {
    const slicer = asMap(context.slicer);
    const fixes = [
        num(slicer.openBoundaryEdgeCount) > 0 || num(slicer.nonManifoldEdgeCount) > 0 ? 'Làm kín mesh, xoá mặt lỗi/non-manifold rồi xuất lại STL/OBJ.' : '',
        num(slicer.volumeCm3) <= 0 ? 'Xuất lại file STL/OBJ có đầy đủ face/triangle, đúng đơn vị mm và không rỗng.' : '',
        'Kiểm tra lại scale, độ dày thành và các chi tiết quá nhỏ trước khi tải lại.',
    ].filter(Boolean);
    return fixes.slice(0, 4);
}

export function normalizePrintLlmReview(input: Partial<PrintLlmReviewResult>, sourceContext: JsonMap = {}): PrintLlmReviewResult {
    const verdict: PrintLlmReviewResult['verdict'] = input.verdict === 'failed'
        ? 'failed'
        : input.verdict === 'warning'
            ? 'warning'
            : (input.hasProblem ? 'warning' : 'good');
    const details = Array.isArray(input.details) ? input.details.map((item) => clean(item, 260)).filter(Boolean).slice(0, 4) : [];
    const fixes = Array.isArray(input.fixes) ? input.fixes.map((item) => clean(item, 260)).filter(Boolean).slice(0, 4) : [];
    const legacyFixes = Array.isArray(input.fixSuggestions)
        ? input.fixSuggestions.map((item) => clean(item, 240)).filter(Boolean).slice(0, 4)
        : [];
    const message = verdict === 'good'
        ? GOOD_MESSAGE
        : clean(input.message || input.customerMessage || input.problemSummary || (verdict === 'failed' ? FAILED_MESSAGE : WARNING_MESSAGE), 520);
    const nextDetails = verdict === 'good' ? [] : (details.length ? details : fallbackDetails(sourceContext));
    const nextFixes = verdict === 'good' ? [] : (fixes.length ? fixes : (legacyFixes.length ? legacyFixes : fallbackFixes(sourceContext)));

    return {
        hasProblem: verdict !== 'good',
        confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
        verdict,
        message: message || (verdict === 'failed' ? FAILED_MESSAGE : WARNING_MESSAGE),
        details: nextDetails,
        fixes: nextFixes,
        problemSummary: verdict === 'good' ? '' : clean(input.problemSummary || message, 520),
        fixSuggestions: nextFixes,
        adminNotes: clean(input.adminNotes, 900),
        customerMessage: message || (verdict === 'failed' ? FAILED_MESSAGE : WARNING_MESSAGE),
    };
}

function buildLlmContext(payload: PrintLlmReviewRequest) {
    const slicer = asMap(payload.slicer);
    const warnings = list(slicer.warnings).map((warning) => {
        const item = asMap(warning);
        return {
            code: item.code,
            severity: item.severity,
            message: item.message,
            ruleId: item.ruleId,
            sourceId: item.sourceId,
        };
    });
    const evidence = [...list(slicer.evidence), ...list(payload.evidence)].map((entry) => {
        const item = asMap(entry);
        return {
            ruleId: item.ruleId,
            sourceId: item.sourceId,
            featureIds: item.featureIds,
            note: item.note,
        };
    });
    const context = {
        task: 'Review 3D print file quality and explain only printability issues for customer/admin.',
        hardRules: [
            'Do not calculate, change, or suggest price.',
            'Use only facts in this context. Do not invent measurements.',
            'Do not tell customer to open a slicer, use a real slicer, or request manual quotation.',
            `If verdict is good, message must be exactly: ${GOOD_MESSAGE}`,
            'If warning or failed, provide concrete details and fixes for the uploader.',
        ],
        file: {
            name: payload.fileName,
            sizeBytes: payload.fileSize,
            extension: ext(payload.fileName),
            contentType: payload.fileType,
        },
        printSettings: {
            technology: payload.printType,
            infill: payload.infill,
            layerHeightMm: payload.layerHeight,
            color: payload.color,
        },
        pricingStatus: {
            priceStatus: slicer.priceStatus,
            geometryStatus: slicer.geometryStatus,
            failureReason: slicer.failureReason,
            canQuote: slicer.priceStatus !== 'failed' && num(slicer.volumeCm3) > 0,
        },
        geometry: {
            volumeCm3: slicer.volumeCm3,
            surfaceAreaCm2: slicer.surfaceAreaCm2,
            bboxMm: slicer.bboxMm,
            bboxVolumeCm3: slicer.bboxVolumeCm3,
            fillRatio: slicer.fillRatio,
            triangleCount: slicer.triangleCount,
            edgeCount: slicer.edgeCount,
        },
        meshHealth: {
            openBoundaryEdgeCount: slicer.openBoundaryEdgeCount,
            nonManifoldEdgeCount: slicer.nonManifoldEdgeCount,
            duplicateVertexRatio: slicer.duplicateVertexRatio,
        },
        printabilitySignals: {
            slenderness: slicer.slenderness,
            thinWallProxy: slicer.thinWallProxy,
            smallDetailProxy: slicer.smallDetailProxy,
            overhangArea45Cm2: slicer.overhangArea45Cm2,
            overhangArea60Cm2: slicer.overhangArea60Cm2,
            supportNeededRatio: slicer.supportNeededRatio,
            supportVolumeCm3: slicer.supportVolumeCm3,
        },
        interpretationHints: [
            'openBoundaryEdgeCount > 0 means mesh has holes/open boundaries.',
            'nonManifoldEdgeCount > 0 means topology is invalid for reliable volume/printing.',
            'volumeCm3 <= 0 or priceStatus=failed means the system cannot quote this file.',
            'high slenderness means tall/thin model may need stronger base/orientation/support.',
            'high thinWallProxy or smallDetailProxy means fragile details may be too thin/small.',
        ],
        warnings,
        evidence,
        webErrors: payload.webErrors || [],
    };
    return { ...payload, slicer, llmContext: context };
}

function buildPrompt(payload: PrintLlmReviewRequest) {
    const context = buildLlmContext(payload).llmContext;
    return [
        '<role>3D print file reviewer for Miniver. Diagnose printability only.</role>',
        '<decision_policy>',
        `- good: file is quotable, has no high/medium warning, and no mesh health problem. Return only "${GOOD_MESSAGE}".`,
        '- warning: file is quotable but warnings/evidence show print risk. Explain risks and uploader fixes.',
        '- failed: priceStatus=failed, volume/bbox invalid, parser error, or unsupported/empty mesh. Explain why and how to re-export STL/OBJ.',
        '</decision_policy>',
        '<output_rules>',
        '- Return pure JSON only. No markdown.',
        '- Schema: {"verdict":"good|warning|failed","message":"string","details":["string"],"fixes":["string"],"adminNotes":"string"}',
        '- Do not mention price, volume, grams, hours, or cm3 when verdict=good.',
        '- Do not use these phrases: mở slicer, slicer thật, báo giá thủ công, score, confidence.',
        '- warning/failed details and fixes must be specific, useful, and based on context evidence.',
        '</output_rules>',
        '<examples>',
        `Good JSON: {"verdict":"good","message":"${GOOD_MESSAGE}","details":[],"fixes":[],"adminNotes":""}`,
        'Warning JSON: {"verdict":"warning","message":"File có điểm cần kiểm tra trước khi in.","details":["Mesh có cạnh hở nên một số vùng có thể in thiếu hoặc sai hình."],"fixes":["Làm kín mesh, xoá mặt lỗi rồi xuất lại STL/OBJ đúng đơn vị mm."],"adminNotes":"Có open boundary edges trong mesh health."}',
        'Failed JSON: {"verdict":"failed","message":"Không tính được thể tích file.","details":["File không có đủ face/triangle hợp lệ hoặc bbox/volume bằng 0."],"fixes":["Xuất lại STL/OBJ có đầy đủ mặt tam giác, đúng scale mm và tải lên lại."],"adminNotes":"priceStatus failed."}',
        '</examples>',
        `<context>${JSON.stringify(context).slice(0, 9000)}</context>`,
    ].join('\n');
}

export async function requestPrintLlmReview(payload: PrintLlmReviewRequest): Promise<{
    status: 'done' | 'skipped' | 'error';
    result: PrintLlmReviewResult;
    error?: string;
}> {
    const baseUrl = process.env.PRINT_LLM_BASE_URL || process.env.OPENAI_BASE_URL;
    const apiKey = process.env.PRINT_LLM_API_KEY || process.env.OPENAI_API_KEY;
    const model = process.env.PRINT_LLM_MODEL || 'cx/gpt-5.5';
    const reasoningEffort = process.env.PRINT_LLM_REASONING_EFFORT || 'medium';
    const context = buildLlmContext(payload);

    if (!baseUrl || !apiKey) {
        return { status: 'skipped', result: normalizePrintLlmReview(EMPTY_PRINT_LLM_REVIEW, context), error: 'LLM review is not configured' };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35_000);
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                reasoning_effort: reasoningEffort,
                temperature: 0.1,
                max_tokens: 850,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: `You are a strict JSON-only 3D printability reviewer. Follow hard rules exactly. If good, say only: ${GOOD_MESSAGE}`,
                    },
                    { role: 'user', content: buildPrompt(payload) },
                ],
            }),
        });
        clearTimeout(timeout);

        const raw = await response.text();
        if (!response.ok) {
            return { status: 'error', result: normalizePrintLlmReview(EMPTY_PRINT_LLM_REVIEW, context), error: `LLM HTTP ${response.status}: ${raw.slice(0, 300)}` };
        }

        const data = safeJsonParse(raw) as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content || raw;
        return { status: 'done', result: normalizePrintLlmReview(safeJsonParse(content), context) };
    } catch (error) {
        return { status: 'error', result: normalizePrintLlmReview(EMPTY_PRINT_LLM_REVIEW, context), error: error instanceof Error ? error.message : 'LLM review failed' };
    }
}
