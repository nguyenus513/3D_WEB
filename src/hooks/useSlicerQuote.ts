import { useState, useEffect, useRef } from 'react';

export interface SliceParams {
    mode: 'fdm' | 'resin';
    profileId: string;
    layerHeight: number;
    infill: number;
    support: boolean;
    quantity: number;
}

export interface SlicerQuoteResult {
    price: number;
    mainMaterialG?: number;
    supportMaterialG?: number;
    totalMaterialG?: number;
    totalResinMl?: number;
    totalResinG?: number;
    printTimeMinutes?: number;
    layerCount?: number;
    source?: string;
    volumeCm3?: number;
    bboxMm?: { x: number; y: number; z: number };
}

export type SliceStatus = 'idle' | 'submitting' | 'polling' | 'completed' | 'failed';

export function useSlicerQuote(file: File | null, params: SliceParams | null) {
    const [status, setStatus] = useState<SliceStatus>('idle');
    const [result, setResult] = useState<SlicerQuoteResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

        if (!file || !params) {
            setStatus('idle');
            setResult(null);
            setError(null);
            return;
        }

        let canceled = false;
        setStatus('submitting');
        setResult(null);
        setError(null);

        const run = async () => {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('mode', params.mode);
                formData.append('profileId', params.profileId);
                formData.append('layerHeight', String(params.layerHeight));
                formData.append('infill', String(params.infill));
                formData.append('support', String(params.support));
                formData.append('quantity', String(params.quantity));

                const res = await fetch('/api/printing/exact-quote', {
                    method: 'POST',
                    body: formData,
                });
                if (canceled) return;

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error((errData as { error?: string }).error || 'Lỗi khi gửi file đến máy chủ');
                }

                const data = await res.json() as {
                    cached?: boolean;
                    result?: SlicerQuoteResult;
                    jobId?: string;
                    status?: string;
                };
                if (canceled) return;

                if (data.cached && data.result) {
                    setResult(data.result);
                    setStatus('completed');
                    return;
                }

                const { jobId } = data;
                if (!jobId) throw new Error('Không nhận được ID công việc từ máy chủ');

                setStatus('polling');

                const poll = async () => {
                    if (canceled) return;
                    try {
                        const sr = await fetch(`/api/printing/quote-status?jobId=${encodeURIComponent(jobId)}`);
                        if (canceled) return;
                        if (!sr.ok) {
                            throw new Error(`Lỗi máy chủ khi kiểm tra trạng thái (${sr.status})`);
                        }
                        const s = await sr.json() as {
                            status: string;
                            result?: SlicerQuoteResult;
                            error?: string;
                        };
                        if (s.status === 'completed' && s.result) {
                            setResult(s.result);
                            setStatus('completed');
                        } else if (s.status === 'failed') {
                            throw new Error(s.error || 'PrusaSlicer không thể xử lý file này');
                        } else {
                            pollTimerRef.current = setTimeout(poll, 2000);
                        }
                    } catch (pollErr) {
                        if (!canceled) {
                            setError((pollErr as Error).message);
                            setStatus('failed');
                        }
                    }
                };
                pollTimerRef.current = setTimeout(poll, 1500);
            } catch (err) {
                if (!canceled) {
                    setError((err as Error).message);
                    setStatus('failed');
                }
            }
        };

        run();

        return () => {
            canceled = true;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        file,
        params?.mode,
        params?.profileId,
        params?.layerHeight,
        params?.infill,
        params?.support,
        params?.quantity,
    ]);

    return { status, result, error };
}
