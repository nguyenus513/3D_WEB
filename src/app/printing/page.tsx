'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AnimatedSection } from '@/components/ui/Animations';
import { Button } from '@/components/ui/button';
import { generateId } from '@/lib/generateId';
import { AddressSelector, ShippingAddress } from '@/components/checkout/AddressSelector';
import { useCart } from '@/lib/store/cart';
import { estimateSlicerLite } from '@/lib/printing/slicer-lite';

type PrintType = 'fdm' | 'resin';

interface FileInfo {
    id: string;
    key?: string;
    fileId?: string;
    name: string;
    url: string;
    thumbnail: string;
    type?: string;
    size?: number;
}

interface AnalysisResult {
    volume: number;
    grams: number;
    hours: number;
    price: number;
    boundingBox: { x: number; y: number; z: number };
    printRisk?: PrintRiskResult;
    aiContext?: PrintAiContext;
    finalAnalysis?: PrintFinalAnalysis;
}

interface PrintRiskIssue {
    code: string;
    severity: 'low' | 'medium' | 'high';
    title: string;
    detail: string;
}

interface PrintRiskResult {
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
    needsManualReview: boolean;
    issues: PrintRiskIssue[];
    suggestions: string[];
    metrics?: Record<string, unknown> | null;
}

interface PrintAiReviewResult {
    hasProblem: boolean;
    confidence: number;
    verdict?: 'good' | 'warning' | 'failed';
    message?: string;
    details?: string[];
    fixes?: string[];
    problemSummary: string;
    fixSuggestions: string[];
    adminNotes: string;
    customerMessage: string;
}

interface PrintAiContext {
    contextId: string;
    status: 'pending' | 'done' | 'skipped' | 'error';
    webErrors: string[];
    result?: PrintAiReviewResult;
    error?: string;
    createdAt: string;
}

interface PrintFinalAnalysis {
    contextId: string;
    status: 'final';
    analysisSource: string;
    slicer?: any;
    llm?: { status?: string; result?: PrintAiReviewResult; error?: string };
    hasProblem?: boolean;
    customerMessage?: string;
    adminNotes?: string;
    fixSuggestions?: string[];
    confidence?: number;
}

interface FileItem {
    id: string;
    file: File;
    analysis: AnalysisResult | null;
    quantity: number;
    analyzing: boolean;
}

interface PrintOrder {
    items: FileItem[];
    type: PrintType;
    color: string;
    infill: string;
    layerHeight: string;
    notes: string;
}

const printTypes = [
    {
        id: 'fdm' as PrintType,
        name: 'FDM',
        desc: 'Nhựa PETG - Bền, chịu nhiệt tốt',
    },
    {
        id: 'resin' as PrintType,
        name: 'SLA (Resin)',
        desc: 'Chi tiết cao, mịn màng',
    },
];

// Colors per print type
const FDM_COLORS = [
    { id: 'white', name: 'Trắng', hex: '#FFFFFF' },
    { id: 'black', name: 'Đen', hex: '#1D1D1F' },
    { id: 'transparent', name: 'Trong suốt', hex: '#E5E5EA' },
];

const RESIN_COLORS = [
    { id: 'white', name: 'Trắng', hex: '#FFFFFF' },
];

const SERVER_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

async function parseApiResponse(response: Response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (contentType.includes('application/json')) {
        try {
            return text ? JSON.parse(text) : {};
        } catch {
            return { error: 'Phản hồi máy chủ không hợp lệ.' };
        }
    }

    if (response.status === 413 || text.toLowerCase().includes('request entity too large')) {
        return { error: 'File 3D quá lớn để phân tích qua server. Hệ thống sẽ phân tích trên trình duyệt hoặc báo lỗi nếu không đọc được thể tích.' };
    }

    return { error: text?.slice(0, 200) || `Upload thất bại (HTTP ${response.status})` };
}

async function getCsrfToken() {
    const response = await fetch('/api/security/csrf', { credentials: 'include' });
    const data = await parseApiResponse(response);
    if (!response.ok || !data?.token) throw new Error(data?.error || 'Không lấy được mã bảo mật upload.');
    return data.token as string;
}

function getModelExtension(file: File) {
    return file.name.toLowerCase().split('.').pop() || '';
}

function getModelContentType(file: File) {
    const ext = getModelExtension(file);
    if (ext === 'stl') return file.type || 'model/stl';
    if (ext === 'obj') return file.type || 'model/obj';
    if (ext === 'step' || ext === 'stp') return file.type || 'model/step';
    return file.type || 'application/octet-stream';
}

function canAutoAnalyzeModel(file: File) {
    const ext = getModelExtension(file);
    return ext === 'stl' || ext === 'obj';
}

function createManualQuoteAnalysis(): AnalysisResult {
    return {
        volume: 0,
        grams: 0,
        hours: 0,
        price: 0,
        boundingBox: { x: 0, y: 0, z: 0 },
        printRisk: createManualReviewRisk(),
    };
}

async function parseFetchJson(response: Response, fallbackLabel: string) {
    const data = await parseApiResponse(response);
    if (!response.ok) {
        throw new Error(data?.error || `${fallbackLabel} thất bại (HTTP ${response.status})`);
    }
    return data;
}

function createManualReviewRisk(): PrintRiskResult {
    return {
        riskScore: 45,
        riskLevel: 'medium',
        confidence: 0.45,
        needsManualReview: true,
        issues: [{
            code: 'MANUAL_REVIEW',
            severity: 'medium',
            title: 'Cần kiểm tra thủ công',
            detail: 'File này cần admin mở bằng slicer trước khi sản xuất.',
        }],
        suggestions: ['Đơn vẫn được tạo, admin sẽ kiểm tra file trước khi in.'],
        metrics: null,
    };
}

function createAiContextId(itemId: string, fileName: string) {
    const safeName = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'model';
    return `ctx_${itemId}_${safeName}`;
}

function createPendingAiContext(itemId: string, fileName: string, webErrors: string[] = []): PrintAiContext {
    return {
        contextId: createAiContextId(itemId, fileName),
        status: 'pending',
        webErrors,
        createdAt: new Date().toISOString(),
    };
}

function getRiskBadgeClass(level: PrintRiskResult['riskLevel']) {
    if (level === 'high') return 'border-white text-white bg-white/10';
    if (level === 'medium') return 'border-white/40 text-white bg-white/5';
    return 'border-white/20 text-white/80 bg-transparent';
}

export default function PrintingPage() {
    const router = useRouter();
    const { addItem, openCart } = useCart();
    const [user, setUser] = useState<{ id: string; email: string } | null>(null);
    const [customerCode, setCustomerCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [order, setOrder] = useState<PrintOrder>({
        items: [],
        type: 'fdm',
        color: 'white',
        infill: '20%',
        layerHeight: '0.2',
        notes: '',
    });
    const [dragActive, setDragActive] = useState(false);
    const [recalculatingPrice, setRecalculatingPrice] = useState(false);
    const priceRecalcRunRef = useRef(0);
    const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);

    // Calculate total price from all items
    const totalPrice = order.items.reduce((sum, item) => {
        return sum + (item.analysis ? item.analysis.price * item.quantity : 0);
    }, 0);
    const grandTotal = totalPrice;

    // Check if any item is analyzing
    const isAnalyzing = order.items.some(item => item.analyzing);
    const isPriceBusy = isAnalyzing || recalculatingPrice;
    const hasPricingFailed = order.items.some(item => item.analysis?.finalAnalysis?.slicer?.priceStatus === 'failed');

    const { data: session, status } = useSession();

    // Auth check on mount
    useEffect(() => {
        if (status === 'loading') return;

        if (status === 'unauthenticated') {
            router.push('/login?redirect=/printing');
            return;
        }

        const fetchUserData = async () => {
            if (!session?.user?.email) return;

            try {
                const res = await fetch('/api/profile');
                if (res.ok) {
                    const response = await res.json();
                    // API returns { success: true, data: profile }
                    const userData = response.data || response;
                    setUser({ id: userData.id, email: session.user.email } as any);
                    setCustomerCode(userData.customer_code || generateId.user());
                }
            } catch (e) {
                console.error('Failed to fetch profile', e);
            }
            setLoading(false);
        };

        fetchUserData();
    }, [status, session, router]);

    const requestLlmReview = async (params: {
        itemId: string;
        file: File;
        risk: PrintRiskResult;
        webErrors?: string[];
    }) => {
        const aiContext = createPendingAiContext(params.itemId, params.file.name, params.webErrors || []);

        setOrder(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === params.itemId && item.analysis
                    ? { ...item, analysis: { ...item.analysis, aiContext } }
                    : item
            )
        }));

        try {
            const response = await fetch('/api/printing/llm-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contextId: aiContext.contextId,
                    fileName: params.file.name,
                    fileSize: params.file.size,
                    fileType: getModelContentType(params.file),
                    printType: order.type,
                    infill: order.infill,
                    layerHeight: order.layerHeight,
                    color: order.color,
                    risk: params.risk,
                    metrics: params.risk.metrics || null,
                    webErrors: aiContext.webErrors,
                }),
            });

            const data = await parseApiResponse(response);
            const nextContext: PrintAiContext = {
                ...aiContext,
                status: response.ok ? (data.status === 'skipped' ? 'skipped' : 'done') : 'error',
                result: data.result,
                error: response.ok ? undefined : (data.error || 'LLM review failed'),
            };

            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === params.itemId && item.analysis
                        ? { ...item, analysis: { ...item.analysis, aiContext: nextContext } }
                        : item
                )
            }));
        } catch (err) {
            const nextContext: PrintAiContext = {
                ...aiContext,
                status: 'error',
                error: err instanceof Error ? err.message : 'LLM review failed',
            };
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === params.itemId && item.analysis
                        ? { ...item, analysis: { ...item.analysis, aiContext: nextContext } }
                        : item
                )
            }));
        }
    };

    const requestLlmForSlicerResult = async (params: {
        contextId: string;
        file: File;
        slicer: unknown;
        webErrors?: string[];
    }) => {
        const response = await fetch('/api/printing/llm-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contextId: params.contextId,
                fileName: params.file.name,
                fileSize: params.file.size,
                fileType: getModelContentType(params.file),
                printType: order.type,
                infill: order.infill,
                layerHeight: order.layerHeight,
                color: order.color,
                slicer: params.slicer,
                evidence: (params.slicer as any)?.evidence || [],
                webErrors: params.webErrors || [],
            }),
        });
        const data = await parseFetchJson(response, 'LLM review');
        return data;
    };

    // Analyze a single file item
    const analyzeItem = async (itemId: string, file: File) => {
        setOrder(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, analyzing: true } : item
            )
        }));

        try {
            const contextId = createAiContextId(itemId, file.name);
            const quote = canAutoAnalyzeModel(file)
                ? await estimateSlicerLite(file, {
                    printType: order.type,
                    infill: order.infill,
                    layerHeight: order.layerHeight,
                    quantity: 1,
                })
                : null;

            const priceFailed = quote?.priceStatus === 'failed' || !quote;
            const metrics = quote
                ? { grams: quote.totalMaterialG, hours: Math.round((quote.printTimeMinutes / 60) * 10) / 10, price: quote.price }
                : { grams: 0, hours: 0, price: 0 };
            let volume = quote?.volumeCm3 || 0;
            let grams = metrics.grams;
            let hours = metrics.hours;
            let price = metrics.price;
            const slicerLiteContext = quote || {
                source: 'volume_failed',
                priceStatus: 'failed',
                geometryStatus: 'failed',
                confidence: 0.15,
                volumeCm3: 0,
                bboxMm: { x: 0, y: 0, z: 0 },
                price,
                warnings: [{ code: 'UNSUPPORTED_FILE', severity: 'high', message: 'Không tính được thể tích file.', ruleId: 'VOLUME_REQUIRED_V1', sourceId: 'miniver_volume_pricing' }],
                evidence: [{ ruleId: 'VOLUME_REQUIRED_V1', sourceId: 'miniver_volume_pricing', featureIds: ['fileType'], note: 'Định dạng không hỗ trợ hoặc không đọc được mesh.' }],
            };
            const pendingFinalData: any = {
                contextId,
                status: 'final',
                analysisSource: quote?.source || 'volume_failed',
                slicer: slicerLiteContext,
                hasProblem: false,
                customerMessage: '',
                adminNotes: '',
                fixSuggestions: [],
                confidence: quote?.confidence || 0.2,
                fallbackQuote: quote ? { source: quote.source, volume, grams, hours, price } : undefined,
            };
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? {
                        ...item,
                        analyzing: false,
                        analysis: {
                            volume,
                            grams,
                            hours,
                            price,
                            boundingBox: slicerLiteContext.bboxMm || { x: 0, y: 0, z: 0 },
                            aiContext: createPendingAiContext(itemId, file.name),
                            finalAnalysis: pendingFinalData,
                        }
                    } : item
                )
            }));
            const llm = await requestLlmForSlicerResult({
                contextId,
                file,
                slicer: slicerLiteContext,
                webErrors: priceFailed ? ['Không tính được thể tích file; không báo giá cho file này.'] : [],
            });
            const finalData: any = {
                contextId,
                status: 'final',
                analysisSource: quote?.source || 'volume_failed',
                slicer: slicerLiteContext,
                llm,
                hasProblem: (quote?.warnings || []).some((warning) => warning.severity === 'high') || llm.result?.hasProblem || false,
                customerMessage: llm.result?.customerMessage || (priceFailed ? 'Không tính được thể tích file. Vui lòng xuất lại file mesh hợp lệ rồi tải lên lại.' : 'Đã tự động báo giá theo thể tích mô hình.'),
                adminNotes: llm.result?.adminNotes || (priceFailed ? 'Không đủ dữ liệu hình học để báo giá.' : 'Volume-first estimate.'),
                fixSuggestions: llm.result?.fixSuggestions || [],
                confidence: llm.result?.confidence || quote?.confidence || 0.2,
                fallbackQuote: quote ? {
                    source: quote.source,
                    volume,
                    grams,
                    hours,
                    price,
                } : undefined,
            };
            price = priceFailed ? 0 : price;
            const riskLevel = finalData.hasProblem ? 'high' : 'low';
            const riskData: PrintRiskResult = {
                riskScore: finalData.hasProblem ? 80 : 10,
                riskLevel,
                confidence: Number(finalData.confidence || 0),
                needsManualReview: Boolean(finalData.hasProblem),
                issues: finalData.hasProblem ? [{
                    code: 'SLICER_LLM_REVIEW',
                    severity: riskLevel,
                    title: 'Slicer/AI phát hiện vấn đề',
                    detail: finalData.customerMessage || finalData.adminNotes || 'Cần admin kiểm tra file.',
                }] : [],
                suggestions: Array.isArray(finalData.fixSuggestions) ? finalData.fixSuggestions : [],
                metrics: finalData.slicer,
            };

            const aiContext: PrintAiContext = {
                contextId: finalData.contextId,
                status: finalData.llm?.status === 'skipped' ? 'skipped' : 'done',
                webErrors: [],
                result: finalData.llm?.result,
                error: finalData.llm?.error,
                createdAt: new Date().toISOString(),
            };

            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? {
                        ...item,
                        analyzing: false,
                        analysis: {
                            volume,
                            grams,
                            hours,
                            price,
                            boundingBox: finalData.slicer?.bboxMm || { x: 0, y: 0, z: 0 },
                            printRisk: riskData,
                            aiContext,
                            finalAnalysis: finalData,
                        }
                    } : item
                )
            }));
        } catch (err) {
            setError((err as Error).message);
            // Clear analyzing state on error
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item =>
                    item.id === itemId ? { ...item, analyzing: false } : item
                )
            }));
        }
    };

    // Re-calculate all items with the same slicer-lite pricing engine used on first upload.
    useEffect(() => {
        const itemsToReprice = order.items.filter(item => item.analysis && canAutoAnalyzeModel(item.file));
        if (itemsToReprice.length === 0) return;

        const runId = ++priceRecalcRunRef.current;
        const settings = {
            printType: order.type,
            infill: order.infill,
            layerHeight: order.layerHeight,
        };
        let cancelled = false;

        setRecalculatingPrice(true);

        Promise.all(itemsToReprice.map(async (item) => {
            const quote = await estimateSlicerLite(item.file, { ...settings, quantity: 1 });
            const priceFailed = quote.priceStatus === 'failed';
            const volume = quote.volumeCm3 || 0;
            const grams = priceFailed ? 0 : quote.totalMaterialG;
            const hours = priceFailed ? 0 : Math.round((quote.printTimeMinutes / 60) * 10) / 10;
            const price = priceFailed ? 0 : quote.price;
            const previousAnalysis = item.analysis;
            const previousFinalAnalysis = previousAnalysis?.finalAnalysis;
            const previousRisk = previousAnalysis?.printRisk;
            const hasHighWarning = quote.warnings.some((warning) => warning.severity === 'high');
            return {
                itemId: item.id,
                analysis: {
                    ...previousAnalysis,
                    volume,
                    grams,
                    hours,
                    price,
                    boundingBox: quote.bboxMm || { x: 0, y: 0, z: 0 },
                    printRisk: previousRisk ? {
                        ...previousRisk,
                        riskLevel: hasHighWarning ? 'high' as const : previousRisk.riskLevel,
                        needsManualReview: hasHighWarning || previousRisk.needsManualReview,
                        metrics: quote as unknown as Record<string, unknown>,
                    } : previousRisk,
                    finalAnalysis: previousFinalAnalysis ? {
                        ...previousFinalAnalysis,
                        analysisSource: quote.source,
                        slicer: quote,
                        hasProblem: hasHighWarning || previousFinalAnalysis.hasProblem,
                        confidence: quote.confidence || previousFinalAnalysis.confidence,
                        fallbackQuote: { source: quote.source, volume, grams, hours, price },
                    } : previousFinalAnalysis,
                } as AnalysisResult,
            };
        })).then((updates) => {
            if (cancelled || priceRecalcRunRef.current !== runId) return;
            setOrder(prev => ({
                ...prev,
                items: prev.items.map(item => {
                    const update = updates.find(next => next.itemId === item.id);
                    return update ? { ...item, analysis: update.analysis } : item;
                }),
            }));
        }).catch((err) => {
            if (!cancelled && priceRecalcRunRef.current === runId) {
                setError(err instanceof Error ? err.message : 'Không cập nhật được giá in.');
            }
        }).finally(() => {
            if (!cancelled && priceRecalcRunRef.current === runId) setRecalculatingPrice(false);
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order.type, order.infill, order.layerHeight]);

    // Upload files to Cloudflare R2. Large 3D files use direct presigned upload to avoid Vercel body limits.
    const uploadFiles = async (orderCode: string): Promise<FileInfo[]> => {
        const uploadedFiles: FileInfo[] = [];

        const uploadParams = (index: number) => ({
            type: 'printing',
            customerCode,
            orderCode,
            index,
            tech: order.type,
            ...(order.type === 'fdm' ? {
                infill: Number(order.infill.replace('%', '')),
                layerHeight: order.layerHeight,
                color: order.color,
            } : {}),
        });

        const uploadDirectToR2 = async (item: FileItem, index: number): Promise<FileInfo> => {
            const csrfToken = await getCsrfToken();
            const contentType = getModelContentType(item.file);
            const presignRes = await fetch('/api/uploads/presign', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken,
                },
                body: JSON.stringify({
                    fileName: item.file.name,
                    contentType,
                    size: item.file.size,
                    params: uploadParams(index),
                }),
            });
            const presignData = await parseApiResponse(presignRes);
            if (!presignRes.ok || !presignData?.data?.url) {
                throw new Error(presignData?.error || 'Không tạo được link upload R2.');
            }

            const putRes = await fetch(presignData.data.url, {
                method: 'PUT',
                headers: { 'Content-Type': contentType },
                body: item.file,
            });
            if (!putRes.ok) {
                throw new Error(`Upload R2 thất bại (HTTP ${putRes.status}).`);
            }

            const completeRes = await fetch('/api/uploads/complete', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken,
                },
                body: JSON.stringify({
                    key: presignData.data.key,
                    fileName: item.file.name,
                    contentType,
                    size: item.file.size,
                    isPublic: false,
                }),
            }).catch(() => null);
            const completeData = completeRes?.ok ? await parseApiResponse(completeRes) : null;
            const trackedFile = completeData?.data?.file;

            const secureUrl = trackedFile?.url || `/api/files/${presignData.data.key}`;
            return {
                id: presignData.data.key,
                key: presignData.data.key,
                fileId: trackedFile?.fileId,
                name: item.file.name,
                url: secureUrl,
                thumbnail: secureUrl,
                type: contentType,
                size: item.file.size,
            };
        };

        for (let i = 0; i < order.items.length; i++) {
            const item = order.items[i];
            const index = i + 1;

            if (item.file.size > SERVER_UPLOAD_LIMIT_BYTES) {
                uploadedFiles.push(await uploadDirectToR2(item, index));
                continue;
            }

            const formData = new FormData();
            formData.append('file', item.file);
            Object.entries(uploadParams(index)).forEach(([key, value]) => {
                if (value !== undefined && value !== null) formData.append(key, String(value));
            });

            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await parseApiResponse(res);

            if (!res.ok) {
                if (res.status === 413) {
                    uploadedFiles.push(await uploadDirectToR2(item, index));
                    continue;
                }
                throw new Error(data.error?.message || data.error || 'Upload thất bại');
            }

            const uploadedFile = data.data?.file || data.file;

            if (uploadedFile) {
                uploadedFiles.push(uploadedFile);
            } else {
                console.error('Upload response missing file object:', data);
                throw new Error('Upload thất bại: phản hồi không hợp lệ');
            }
        }

        return uploadedFiles;
    };

    // Submit order
    const handleSubmit = async () => {
        // Must have at least one item with analysis
        const hasValidItem = order.items.length > 0 && order.items.every(item => item.analysis !== null && !item.analyzing);
        if (!user || !hasValidItem) return;
        if (isPriceBusy) {
            setError('Vui lòng chờ hệ thống cập nhật giá xong.');
            return;
        }
        if (hasPricingFailed) {
            setError('Có file chưa tính được thể tích. Vui lòng sửa/xuất lại file rồi tải lên lại.');
            return;
        }

        // Validate shipping address
        if (!shippingAddress || !shippingAddress.full_name || !shippingAddress.phone || !shippingAddress.province) {
            setError('Vui lòng nhập đầy đủ thông tin địa chỉ giao hàng');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const orderCode = generateId.printing();

            // Upload files to Drive
            const files = await uploadFiles(orderCode);

            // Call API to create order (Bypasses RLS)
            const res = await fetch('/api/orders/printing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: order.items.map(item => ({
                        quantity: item.quantity,
                        analysis: item.analysis,
                        printRisk: item.analysis?.printRisk || null,
                        aiContext: item.analysis?.aiContext || null,
                        finalAnalysis: item.analysis?.finalAnalysis || null,
                    })),
                    files: files.map(f => ({
                        id: f.id,
                        key: f.key || f.id,
                        fileId: f.fileId,
                        name: f.name,
                        url: f.url,
                        type: f.type,
                        size: f.size,
                    })),
                    type: order.type,
                    color: order.color,
                    infill: order.infill,
                    layerHeight: order.layerHeight,
                    notes: order.notes,
                    shippingAddress: {
                        full_name: shippingAddress.full_name,
                        phone: shippingAddress.phone,
                        address_line: shippingAddress.address_line,
                        ward: shippingAddress.ward || '',
                        district: shippingAddress.district || '',
                        province: shippingAddress.province,
                    },
                    totalPrice: grandTotal
                })
            });

            const data = await parseApiResponse(res);

            if (!res.ok) {
                throw new Error(data.error?.message || data.error || 'Không tạo được đơn in 3D');
            }

            const orderId = data.orderId;

            router.push('/checkout/success/' + orderId);
        } catch (err) {
            console.error('Submit error:', err);
            setError((err as Error).message);
            setSubmitting(false);
        }
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const validFiles = Array.from(e.dataTransfer.files).filter(
                f => ['stl', 'obj'].includes(getModelExtension(f))
            );

            // Create new FileItems for each file
            const newItems: FileItem[] = validFiles.map(file => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                analysis: null,
                quantity: 1,
                analyzing: false,
            }));

            setOrder(prev => ({ ...prev, items: [...prev.items, ...newItems] }));

            // Trigger analysis for each new file
            newItems.forEach(item => {
                analyzeItem(item.id, item.file);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order.type, order.infill, order.layerHeight]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const validFiles = Array.from(e.target.files).filter(
                f => ['stl', 'obj'].includes(getModelExtension(f))
            );

            // Create new FileItems for each file
            const newItems: FileItem[] = validFiles.map(file => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                analysis: null,
                quantity: 1,
                analyzing: false,
            }));

            setOrder(prev => ({ ...prev, items: [...prev.items, ...newItems] }));

            // Trigger analysis for each new file
            newItems.forEach(item => {
                analyzeItem(item.id, item.file);
            });

            // Reset the input to allow re-selecting same file
            e.target.value = '';
        }
    };

    const removeItem = (itemId: string) => {
        setOrder(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== itemId),
        }));
    };

    // Update item quantity
    const updateItemQuantity = (itemId: string, delta: number) => {
        setOrder(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId
                    ? { ...item, quantity: Math.max(1, item.quantity + delta) }
                    : item
            ),
        }));
    };

    // Add to cart instead of direct order
    const handleAddToCart = () => {
        const hasValidItem = order.items.length > 0 && order.items.every(item => item.analysis !== null && !item.analyzing);
        if (!hasValidItem) return;
        if (isPriceBusy) {
            setError('Vui lòng chờ hệ thống cập nhật giá xong.');
            return;
        }
        if (hasPricingFailed) {
            setError('Có file chưa tính được thể tích. Vui lòng sửa/xuất lại file rồi tải lên lại.');
            return;
        }

        // Add each item with analysis to cart
        order.items.forEach(item => {
            if (item.analysis) {
                addItem({
                    type: 'print',
                    name: item.file.name,
                    price: item.analysis.price,
                    quantity: item.quantity,
                    printOptions: {
                        type: order.type,
                        color: order.color,
                        infill: order.infill,
                        layerHeight: order.layerHeight,
                    },
                    printFiles: [{
                        id: item.id,
                        name: item.file.name,
                        analysis: item.analysis,
                    }],
                });
            }
        });

        // Clear the order items
        setOrder(prev => ({ ...prev, items: [] }));

        // Open cart to show added items
        openCart();
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-secondary)]">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--bg-void)] pt-28 pb-20">
            <div className="max-w-[1200px] mx-auto px-6">
                {/* Header */}
                <AnimatedSection className="text-center mb-12">
                    <span className="text-sm text-[var(--text-secondary)] font-medium tracking-widest uppercase mb-4 block">
                        3D Printing Service
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] tracking-tight mb-4">
                        Dịch Vụ In 3D
                    </h1>
                    <p className="text-[var(--text-secondary)] max-w-lg mx-auto">
                        Upload file STL/OBJ của bạn, hệ thống sẽ tự động tính giá
                    </p>
                </AnimatedSection>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left - Upload & Options */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* File Upload */}
                        <AnimatedSection delay={0.1}>
                            <div className="bg-[var(--material-panel)] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Upload file 3D</h2>

                                <div
                                    onDragEnter={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDragOver={handleDrag}
                                    onDrop={handleDrop}
                                    className={`
                    border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer
                    ${dragActive
                                            ? 'border-white/30 bg-[var(--material-glass)]'
                                            : 'border-[var(--border-color)] hover:border-white/40'
                                        }
                  `}
                                >
                                    <input
                                        type="file"
                                        accept=".stl,.obj"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <div className="mb-4 flex justify-center text-[var(--text-secondary)]">
                                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <p className="text-[var(--text-primary)] font-medium">Kéo thả file 3D vào đây</p>
                                        <p className="text-[var(--text-secondary)] text-sm mt-2">Hỗ trợ: STL, OBJ</p>
                                    </label>
                                </div>

                                {/* File List with Individual Quantities */}
                                {order.items.length > 0 && (
                                    <div className="mt-6 space-y-4">
                                        {order.items.map((item) => (
                                            <div key={item.id} className="bg-gradient-to-br from-[#2D2D2F] to-[#1D1D1F] rounded-xl p-4 border border-[var(--border-color)]">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="text-[var(--text-secondary)] flex-shrink-0">
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-[var(--text-primary)] font-medium text-sm truncate">{item.file.name}</p>
                                                            <p className="text-[var(--text-secondary)] text-xs">
                                                                {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="w-8 h-8 rounded-full bg-[var(--material-glass)] text-[var(--text-primary)] hover:bg-red-500 transition-colors flex items-center justify-center flex-shrink-0"
                                                    >
                                                        ×
                                                    </button>
                                                </div>

                                                {/* Analysis Loading */}
                                                {item.analyzing && (
                                                    <div className="bg-[#2D2D2F] rounded-lg p-3 text-center">
                                                        <div className="w-5 h-5 border-2 border-[var(--border-color)] border-t-white rounded-full animate-spin mx-auto mb-2" />
                                                        <p className="text-[var(--text-secondary)] text-xs">Đang tính thể tích và gửi AI kiểm tra file...</p>
                                                    </div>
                                                )}

                                                {/* Analysis Result */}
                                                {item.analysis && !item.analyzing && (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-4 gap-2 text-center">
                                                            <div>
                                                                <span className="text-[var(--text-secondary)] text-xs block">Thể tích</span>
                                                                <span className="text-sm font-bold text-[var(--text-primary)]">{item.analysis.volume}</span>
                                                                <span className="text-[var(--text-tertiary)] text-xs">cm³</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[var(--text-secondary)] text-xs block">Khối lượng</span>
                                                                <span className="text-sm font-bold text-[var(--text-primary)]">{item.analysis.grams}</span>
                                                                <span className="text-[var(--text-tertiary)] text-xs">g</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[var(--text-secondary)] text-xs block">Thời gian</span>
                                                                <span className="text-sm font-bold text-[var(--text-primary)]">{item.analysis.hours}</span>
                                                                <span className="text-[var(--text-tertiary)] text-xs">h</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[var(--text-secondary)] text-xs block">Giá/cái</span>
                                                                <span className="text-sm font-bold text-[var(--text-primary)]">{item.analysis.price.toLocaleString('vi-VN')}</span>
                                                                <span className="text-[var(--text-tertiary)] text-xs"> VND</span>
                                                            </div>
                                                        </div>

                                                        {item.analysis.aiContext?.status === 'pending' && (
                                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-[var(--text-secondary)]">Đang xử lý...</div>
                                                        )}
                                                        {item.analysis.aiContext?.status === 'error' && (
                                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-[var(--text-secondary)]">Không lấy được đánh giá AI. Giá vẫn được tính bằng hệ thống.</div>
                                                        )}
                                                        {item.analysis.aiContext?.status && item.analysis.aiContext.status !== 'pending' && item.analysis.aiContext.status !== 'error' && item.analysis.aiContext.result && (
                                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/85 space-y-2">
                                                                {item.analysis.aiContext.result.verdict === 'good' ? (
                                                                    <p>{item.analysis.aiContext.result.message || 'Tốt. Có thể in ngay.'}</p>
                                                                ) : (
                                                                    <>
                                                                        <p>{item.analysis.aiContext.result.message || item.analysis.aiContext.result.customerMessage || item.analysis.aiContext.result.problemSummary || 'Có điểm cần kiểm tra trước khi in.'}</p>
                                                                        {(item.analysis.aiContext.result.details || []).slice(0, 4).map((detail, idx) => (
                                                                            <p key={`detail-${idx}`}>• {detail}</p>
                                                                        ))}
                                                                        {(item.analysis.aiContext.result.fixes || item.analysis.aiContext.result.fixSuggestions || []).slice(0, 4).map((fix, idx) => (
                                                                            <p key={`fix-${idx}`}>• {fix}</p>
                                                                        ))}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Quantity Controls */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                                                            <span className="text-[var(--text-secondary)] text-sm">Số lượng</span>
                                                            <div className="inline-flex items-center bg-[#2D2D2F] rounded-full">
                                                                <button
                                                                    onClick={() => updateItemQuantity(item.id, -1)}
                                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="w-8 text-center text-[var(--text-primary)] font-medium text-sm">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => updateItemQuantity(item.id, 1)}
                                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </AnimatedSection>

                        {/* Print Settings */}
                        <AnimatedSection delay={0.2}>
                            <div className="bg-[var(--material-panel)] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Cấu hình in</h2>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[var(--text-secondary)] text-sm mb-3">Công nghệ in</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {printTypes.map((type) => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setOrder(prev => ({ ...prev, type: type.id, color: type.id === 'fdm' ? 'white' : 'white' }))}
                                                    className={`p-4 rounded-xl border text-left transition-all ${order.type === type.id ? 'border-white bg-white/10' : 'border-[var(--border-color)] hover:border-white/30'}`}
                                                >
                                                    <span className="block text-[var(--text-primary)] font-medium">{type.name}</span>
                                                    <span className="block text-[var(--text-secondary)] text-sm mt-1">{type.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[var(--text-secondary)] text-sm mb-3">Màu sắc</label>
                                        <div className="flex flex-wrap gap-3">
                                            {(order.type === 'fdm' ? FDM_COLORS : RESIN_COLORS).map((color) => (
                                                <button
                                                    key={color.id}
                                                    onClick={() => setOrder(prev => ({ ...prev, color: color.id }))}
                                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${order.color === color.id ? 'border-white bg-white/10' : 'border-[var(--border-color)] hover:border-white/30'}`}
                                                >
                                                    <span className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: color.hex }} />
                                                    <span className="text-[var(--text-primary)] text-sm">{color.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {order.type === 'fdm' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[var(--text-secondary)] text-sm mb-3">Infill</label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {['15%', '20%', '30%', '50%'].map((infill) => (
                                                        <button
                                                            key={infill}
                                                            onClick={() => setOrder(prev => ({ ...prev, infill }))}
                                                            className={`py-3 rounded-xl border text-sm transition-all ${order.infill === infill ? 'border-white bg-white text-black' : 'border-[var(--border-color)] text-white hover:border-white/30'}`}
                                                        >
                                                            {infill}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[var(--text-secondary)] text-sm mb-3">Layer height</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['0.2', '0.12', '0.08'].map((layer) => (
                                                        <button
                                                            key={layer}
                                                            onClick={() => setOrder(prev => ({ ...prev, layerHeight: layer }))}
                                                            className={`py-3 rounded-xl border text-sm transition-all ${order.layerHeight === layer ? 'border-white bg-white text-black' : 'border-[var(--border-color)] text-white hover:border-white/30'}`}
                                                        >
                                                            {layer}mm
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </AnimatedSection>

                        {/* Notes */}
                        <AnimatedSection delay={0.3}>
                            <div className="bg-[var(--material-panel)] rounded-3xl p-8">
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Ghi chú</h2>
                                <textarea
                                    value={order.notes}
                                    onChange={(e) => setOrder(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Yêu cầu thêm"
                                    className="w-full p-4 bg-[#2D2D2F] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
                                    rows={3}
                                />
                            </div>
                        </AnimatedSection>
                    </div>

                    {/* Right - Order Summary */}
                    <div className="lg:col-span-1">
                        <AnimatedSection delay={0.4}>
                            <div className="bg-[var(--material-panel)] rounded-3xl p-8 sticky top-28">
                                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Đơn hàng</h2>

                                {order.items.length > 0 && (
                                    <div className="mb-6 space-y-2 max-h-60 overflow-y-auto">
                                        {order.items.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-[var(--border-color)]">
                                                <span className="text-[var(--text-primary)]/80 truncate max-w-[150px]">{item.file.name}</span>
                                                <span className="text-[var(--text-primary)] flex items-center gap-2">
                                                    <span className="text-[var(--text-secondary)]">x{item.quantity}</span>
                                                    {item.analysis && (
                                                        <span className="font-medium">{(item.analysis.price * item.quantity).toLocaleString('vi-VN')} VND</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3 mb-6 text-sm">
                                    <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Loại in</span><span className="text-[var(--text-primary)]">{printTypes.find(t => t.id === order.type)?.name}</span></div>
                                    <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Màu sắc</span><span className="text-[var(--text-primary)]">{(order.type === 'fdm' ? FDM_COLORS : RESIN_COLORS).find(c => c.id === order.color)?.name}</span></div>
                                    <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Số sản phẩm</span><span className="text-[var(--text-primary)]">{order.items.length}</span></div>
                                    <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Tổng số lượng</span><span className="text-[var(--text-primary)]">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
                                </div>

                                <div className="border-t border-[var(--border-color)] pt-4 mb-6">
                                    {order.items.some(item => item.analysis) ? (
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-[var(--text-secondary)]">Tạm tính</span>
                                                <span className="text-[var(--text-primary)] text-right">
                                                    {recalculatingPrice ? 'Đang cập nhật...' : `${totalPrice.toLocaleString('vi-VN')} VND`}
                                                    {order.type === 'fdm' && (
                                                        <div className="text-xs text-right text-[var(--text-tertiary)] mt-1 space-y-1">
                                                            <span className="block">Infill: {order.infill}</span>
                                                            <span className="block">Layer: {order.layerHeight}mm</span>
                                                        </div>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border-color)]">
                                                <span className="text-[var(--text-primary)] font-medium">Tổng cộng</span>
                                                <span className="text-2xl font-bold text-[var(--text-primary)]">{recalculatingPrice ? '...' : `${grandTotal.toLocaleString('vi-VN')} VND`}</span>
                                            </div>
                                            <p className="text-amber-400 text-xs">*Thanh toán 100% cho dịch vụ in 3D</p>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4"><p className="text-[var(--text-tertiary)] text-sm">Upload file để xem giá ước tính</p></div>
                                    )}
                                </div>

                                <div className="border-t border-[var(--border-color)] pt-4 mb-4">
                                    <h3 className="text-[var(--text-primary)] font-medium mb-3">Địa chỉ giao hàng</h3>
                                    <AddressSelector userId={user?.id} value={shippingAddress} onChange={setShippingAddress} disabled={submitting} />
                                </div>

                                {error && (<div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>)}

                                <div className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                                    <div className="flex items-end justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Tổng thanh toán</p>
                                            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{recalculatingPrice ? 'Đang cập nhật giá theo cấu hình mới' : 'Giá đã tính theo file và cấu hình in'}</p>
                                        </div>
                                        <div className="text-right text-2xl font-bold text-white">{recalculatingPrice ? '...' : `${grandTotal.toLocaleString('vi-VN')} VND`}</div>
                                    </div>

                                    <Button variant="secondary" size="lg" className="w-full border border-white/20 bg-transparent text-white hover:bg-white/10" disabled={order.items.length === 0 || !order.items.some(item => item.analysis) || isPriceBusy || hasPricingFailed} onClick={handleAddToCart}>
                                        {order.items.length === 0 ? 'Vui lòng upload file' : isPriceBusy ? 'Đang cập nhật giá...' : 'Thêm vào giỏ hàng'}
                                    </Button>

                                    <Button variant="default" size="lg" className="w-full bg-white text-black hover:bg-white/85 active:bg-white/75" disabled={order.items.length === 0 || !order.items.some(item => item.analysis) || submitting || isPriceBusy || !shippingAddress || hasPricingFailed} onClick={handleSubmit}>
                                        {submitting ? 'Đang xử lý...' : order.items.length === 0 ? 'Vui lòng upload file' : isPriceBusy ? 'Đang cập nhật giá...' : !shippingAddress ? 'Chọn địa chỉ để đặt in ngay' : `Đặt in ngay - ${grandTotal.toLocaleString('vi-VN')} VND`}
                                    </Button>
                                </div>
                            </div>
                        </AnimatedSection>
                    </div>
                </div>
            </div>
        </div >
    );
}
