import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isRateLimited, rateLimitedResponse } from '@/lib/security';
import { extractMeshFeatures } from '@/lib/ai/features/meshFeatures';

type PrintType = 'fdm' | 'resin';
type RiskLevel = 'low' | 'medium' | 'high';

interface RiskIssue {
    code: string;
    severity: RiskLevel;
    title: string;
    detail: string;
}

const BUILD_VOLUME_MM = { x: 256, y: 256, z: 256 };

function clampScore(value: number) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function addIssue(issues: RiskIssue[], code: string, severity: RiskLevel, title: string, detail: string) {
    issues.push({ code, severity, title, detail });
}

function severityWeight(level: RiskLevel) {
    if (level === 'high') return 28;
    if (level === 'medium') return 16;
    return 7;
}

function analyzeRules(params: {
    printType: PrintType;
    fileName: string;
    fileSize: number;
    features: ReturnType<typeof extractMeshFeatures>['features'];
}) {
    const { printType, fileName, fileSize, features } = params;
    const issues: RiskIssue[] = [];
    const suggestions: string[] = [];
    const ext = fileName.toLowerCase().split('.').pop() || '';

    if (features.bbox_x > BUILD_VOLUME_MM.x || features.bbox_y > BUILD_VOLUME_MM.y || features.bbox_z > BUILD_VOLUME_MM.z) {
        addIssue(issues, 'BUILD_VOLUME', 'high', 'Vuot khung in', `Kich thuoc ${features.bbox_x} x ${features.bbox_y} x ${features.bbox_z}mm lon hon khung ${BUILD_VOLUME_MM.x} x ${BUILD_VOLUME_MM.y} x ${BUILD_VOLUME_MM.z}mm.`);
        suggestions.push('Chia model thanh nhieu phan hoac giam ti le truoc khi dat in.');
    }

    if (features.slenderness >= 8) {
        addIssue(issues, 'SLENDER_WOBBLE', 'high', 'Dang cao/manh', 'Model qua cao hoac qua mong, de rung va gay khi in.');
        suggestions.push('Tang be day, them de, hoac in nam ngang neu co the.');
    } else if (features.slenderness >= 5) {
        addIssue(issues, 'SLENDER_WOBBLE', 'medium', 'Dang hoi manh', 'Ti le dai/rong cao, can kiem tra huong in.');
        suggestions.push('Can nhac xoay model de tang dien tich bam ban.');
    }

    if (features.fill_ratio > 0 && features.fill_ratio < 0.015) {
        addIssue(issues, 'THIN_SHELL', 'high', 'Tuong mong/chi tiet mong', 'Ti le the tich so voi hop bao qua thap, co nguy co vo hoac in loi.');
        suggestions.push('Tang do day tuong toi thieu 1.2mm cho FDM hoac 0.8mm cho resin.');
    } else if (features.thin_part_proxy > 0.75) {
        addIssue(issues, 'DETAIL_DENSITY', 'medium', 'Nhieu chi tiet nho', 'Mat do be mat cao, nen admin kiem tra support va do day.');
        suggestions.push('Don gian hoa chi tiet nho hoac chon resin neu can do min cao.');
    }

    if (features.support_proxy > 0) {
        addIssue(issues, 'SUPPORT_NEEDED', printType === 'fdm' ? 'medium' : 'low', 'Co the can support', 'Hinh dang cao/nhon co the can support hoac doi huong in.');
        suggestions.push('Kiem tra support trong slicer truoc khi san xuat.');
    }

    if (features.triangle_count > 1_000_000 || fileSize > 80 * 1024 * 1024) {
        addIssue(issues, 'HEAVY_MESH', 'medium', 'Mesh rat nang', 'File co nhieu tam giac hoac dung luong lon, co the cham khi slice.');
        suggestions.push('Giam polygon/decimate mesh truoc khi upload neu khong can chi tiet qua cao.');
    }

    if (printType === 'resin') {
        if (features.fill_ratio > 0.55 && Math.max(features.bbox_x, features.bbox_y) > 70) {
            addIssue(issues, 'RESIN_SUCTION', 'high', 'Nguy co suction resin', 'Khoi dac lon khi in resin co the tao luc hut manh, de tach khoi ban in.');
            suggestions.push('Hollow model, them lo thoat resin va nghieng model khi slice.');
        }
        if (ext === 'stl' || ext === 'obj') {
            suggestions.push('Voi resin, admin nen kiem tra island/support trong slicer truoc khi xac nhan.');
        }
    }

    if (printType === 'fdm' && features.infill_pct >= 0.5 && features.volume_cm3 > 80) {
        addIssue(issues, 'HIGH_INFILL_COST', 'medium', 'Infill cao', 'Infill cao lam tang thoi gian, gia va nguy co cong venh.');
        suggestions.push('Dung 15-30% infill neu khong can chiu luc lon.');
    }

    const score = clampScore(issues.reduce((sum, issue) => sum + severityWeight(issue.severity), 8));
    const riskLevel: RiskLevel = score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';
    const confidence = Math.min(0.92, 0.58 + (features.triangle_count > 500 ? 0.14 : 0) + (features.volume_cm3 > 1 ? 0.12 : 0) + (issues.length > 0 ? 0.08 : 0));

    if (suggestions.length === 0) {
        suggestions.push('File co ve on. Van nen slice lai truoc khi san xuat that.');
    }

    return {
        riskScore: score,
        riskLevel,
        confidence: Math.round(confidence * 100) / 100,
        needsManualReview: riskLevel !== 'low',
        issues,
        suggestions: Array.from(new Set(suggestions)),
    };
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = isRateLimited(request);
        if (rateLimit.limited) return rateLimitedResponse(rateLimit.resetIn);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const printType = (formData.get('type') || 'fdm') as PrintType;
        const infill = String(formData.get('infill') || '20%');
        const layerHeight = String(formData.get('layerHeight') || '0.2');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith('.stl') && !lowerName.endsWith('.obj')) {
            return NextResponse.json({
                riskScore: 45,
                riskLevel: 'medium',
                confidence: 0.45,
                needsManualReview: true,
                issues: [{
                    code: 'MANUAL_REVIEW',
                    severity: 'medium',
                    title: 'Can slice thu cong',
                    detail: 'Dinh dang nay can slicer/admin kiem tra truc tiep truoc khi san xuat.',
                }],
                suggestions: ['Upload 3MF van duoc nhan don, nhung can admin kiem tra trong slicer.'],
                metrics: null,
            });
        }

        const buffer = await file.arrayBuffer();
        const extracted = extractMeshFeatures(buffer, file.name, { printType, infill, layerHeight });
        const risk = analyzeRules({ printType, fileName: file.name, fileSize: file.size, features: extracted.features });

        return NextResponse.json({
            ...risk,
            metrics: {
                ...extracted.features,
                boundingBox: extracted.boundingBox,
                triangleCount: extracted.triangleCount,
                surfaceAreaCm2: Math.round(extracted.surfaceArea_cm2 * 100) / 100,
            },
        });
    } catch (error) {
        console.error('[printing/analyze-risk]', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Risk analysis failed' }, { status: 500 });
    }
}
