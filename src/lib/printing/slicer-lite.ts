import { strFromU8, unzipSync } from 'fflate';
import { extractMeshFeatures } from '@/lib/ai/features/meshFeatures';
import { calculatePrintingPrice } from '@/lib/printing/pricing-engine';

export type PrintTechnology = 'fdm' | 'resin';

export interface SlicerLiteSettings {
    printType: PrintTechnology;
    infill: string;
    layerHeight: string;
    quantity?: number;
}

export interface SlicerLiteQuote {
    source: 'slicer_lite_volume' | 'slicer_lite_3mf' | 'slicer_lite_bbox_floor' | 'volume_failed';
    priceStatus: 'priced' | 'estimated_from_bbox' | 'failed';
    geometryStatus: 'valid' | 'estimated_from_bbox' | 'failed';
    failureReason?: string;
    confidence: number;
    volumeCm3: number;
    surfaceAreaCm2: number;
    bboxMm: { x: number; y: number; z: number };
    bboxVolumeCm3: number;
    fillRatio: number;
    triangleCount: number;
    edgeCount: number;
    nonManifoldEdgeCount: number;
    openBoundaryEdgeCount: number;
    duplicateVertexRatio: number;
    slenderness: number;
    flatBaseAreaProxy: number;
    centerOfMassZRatio: number;
    thinWallProxy: number;
    smallDetailProxy: number;
    overhangArea45Cm2: number;
    overhangArea60Cm2: number;
    supportNeededRatio: number;
    supportVolumeCm3: number;
    supportMassG: number;
    modelMassG: number;
    totalMaterialG: number;
    printTimeMinutes: number;
    price: number;
    pricing: {
        materialCost: number;
        machineTimeCost: number;
        complexityCost: number;
        minimumApplied: boolean;
        infillMultiplier?: number;
        formulaVersion?: string;
    };
    warnings: Array<{ code: string; severity: 'low' | 'medium' | 'high'; message: string; ruleId: string; sourceId: string }>;
    evidence: Array<{ ruleId: string; sourceId: string; featureIds: string[]; note: string }>;
    features: Record<string, number | string | boolean>;
}

interface MeshGeometry {
    source: SlicerLiteQuote['source'];
    volumeCm3: number;
    surfaceAreaCm2: number;
    bboxMm: { x: number; y: number; z: number };
    triangleCount: number;
    edgeCount?: number;
    nonManifoldEdgeCount?: number;
    openBoundaryEdgeCount?: number;
    centerOfMassZRatio?: number;
    overhangArea45Cm2?: number;
    overhangArea60Cm2?: number;
}

function emptyFailedQuote(file: File, settings: SlicerLiteSettings, reason: string): SlicerLiteQuote {
    return {
        source: 'volume_failed',
        priceStatus: 'failed',
        geometryStatus: 'failed',
        failureReason: reason,
        confidence: 0,
        volumeCm3: 0,
        surfaceAreaCm2: 0,
        bboxMm: { x: 0, y: 0, z: 0 },
        bboxVolumeCm3: 0,
        fillRatio: 0,
        triangleCount: 0,
        edgeCount: 0,
        nonManifoldEdgeCount: 0,
        openBoundaryEdgeCount: 0,
        duplicateVertexRatio: 0,
        slenderness: 0,
        flatBaseAreaProxy: 0,
        centerOfMassZRatio: 0,
        thinWallProxy: 0,
        smallDetailProxy: 0,
        overhangArea45Cm2: 0,
        overhangArea60Cm2: 0,
        supportNeededRatio: 0,
        supportVolumeCm3: 0,
        supportMassG: 0,
        modelMassG: 0,
        totalMaterialG: 0,
        printTimeMinutes: 0,
        price: 0,
        pricing: { materialCost: 0, machineTimeCost: 0, complexityCost: 0, minimumApplied: false },
        warnings: [{ code: 'VOLUME_PARSE_FAILED', severity: 'high', message: 'Không tính được thể tích file.', ruleId: 'VOLUME_REQUIRED_V1', sourceId: 'miniver_volume_pricing' }],
        evidence: [{ ruleId: 'VOLUME_REQUIRED_V1', sourceId: 'miniver_volume_pricing', featureIds: ['fileName', 'fileSize', 'fileType'], note: reason }],
        features: { printType: settings.printType, infill: settings.infill, layerHeight: settings.layerHeight, fileName: file.name, fileSize: file.size, parseError: reason },
    };
}

const DENSITY: Record<PrintTechnology, number> = { fdm: 1.24, resin: 1.1 };
const FDM_FLOW_G_PER_HOUR = 12;
const RESIN_EFFECTIVE_G_PER_HOUR = 6;

function round(value: number, digits = 2) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function getExt(fileName: string) {
    return fileName.toLowerCase().split('.').pop() || '';
}

function parse3mf(buffer: ArrayBuffer): MeshGeometry {
    const files = unzipSync(new Uint8Array(buffer));
    const modelEntry = Object.entries(files).find(([name]) => name.toLowerCase().endsWith('.model'));
    if (!modelEntry) throw new Error('Không tìm thấy mesh trong file 3MF.');

    const xml = strFromU8(modelEntry[1]);
    const vertices: [number, number, number][] = [];
    const vertexRegex = /<vertex\b([^>]*?)\/>/gi;
    let vertexMatch: RegExpExecArray | null;
    while ((vertexMatch = vertexRegex.exec(xml)) !== null) {
        const attrs: Record<string, number> = {};
        const attrRegex = /\b(x|y|z)="([-\d.eE+]+)"/gi;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(vertexMatch[1])) !== null) attrs[attrMatch[1]] = Number(attrMatch[2]);
        if (Number.isFinite(attrs.x) && Number.isFinite(attrs.y) && Number.isFinite(attrs.z)) vertices.push([attrs.x, attrs.y, attrs.z]);
    }

    const faces: [number, number, number][] = [];
    const triangleRegex = /<triangle\b([^>]*?)\/>/gi;
    let triangleMatch: RegExpExecArray | null;
    while ((triangleMatch = triangleRegex.exec(xml)) !== null) {
        const attrs: Record<string, number> = {};
        const attrRegex = /\b(v1|v2|v3)="(\d+)"/gi;
        let attrMatch: RegExpExecArray | null;
        while ((attrMatch = attrRegex.exec(triangleMatch[1])) !== null) attrs[attrMatch[1]] = Number(attrMatch[2]);
        if (vertices[attrs.v1] && vertices[attrs.v2] && vertices[attrs.v3]) faces.push([attrs.v1, attrs.v2, attrs.v3]);
    }

    if (vertices.length === 0 || faces.length === 0) throw new Error('3MF không có đủ vertex/triangle để tính thể tích.');
    return computeGeometry(vertices, faces, 'slicer_lite_3mf');
}

function computeGeometry(vertices: [number, number, number][], faces: [number, number, number][], source: SlicerLiteQuote['source']): MeshGeometry {
    let volumeMm3 = 0;
    let surfaceAreaMm2 = 0;
    let overhang45Mm2 = 0;
    let overhang60Mm2 = 0;
    let weightedZ = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const edgeUse = new Map<string, number>();

    const addEdge = (a: number, b: number) => {
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
    };

    for (const [i0, i1, i2] of faces) {
        const v0 = vertices[i0], v1 = vertices[i1], v2 = vertices[i2];
        if (!v0 || !v1 || !v2) continue;
        for (const [x, y, z] of [v0, v1, v2]) {
            minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
        }
        addEdge(i0, i1); addEdge(i1, i2); addEdge(i2, i0);
        const ax = v1[0] - v0[0], ay = v1[1] - v0[1], az = v1[2] - v0[2];
        const bx = v2[0] - v0[0], by = v2[1] - v0[1], bz = v2[2] - v0[2];
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        const area = Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
        surfaceAreaMm2 += area;
        const normalLength = Math.max(Math.sqrt(nx * nx + ny * ny + nz * nz), 0.0001);
        const downward = -nz / normalLength;
        if (downward > Math.cos(Math.PI / 4)) overhang45Mm2 += area;
        if (downward > Math.cos(Math.PI / 3)) overhang60Mm2 += area;
        const cx = v1[1] * v2[2] - v1[2] * v2[1];
        const cy = v1[2] * v2[0] - v1[0] * v2[2];
        const cz = v1[0] * v2[1] - v1[1] * v2[0];
        const signed = (v0[0] * cx + v0[1] * cy + v0[2] * cz) / 6;
        volumeMm3 += signed;
        weightedZ += Math.abs(signed) * ((v0[2] + v1[2] + v2[2]) / 4);
    }

    const height = Math.max(maxZ - minZ, 0.1);
    const volumeAbs = Math.abs(volumeMm3);
    const edgeCounts = [...edgeUse.values()];
    return {
        source,
        volumeCm3: volumeAbs / 1000,
        surfaceAreaCm2: surfaceAreaMm2 / 100,
        bboxMm: { x: round(maxX - minX, 1), y: round(maxY - minY, 1), z: round(height, 1) },
        triangleCount: faces.length,
        edgeCount: edgeUse.size,
        openBoundaryEdgeCount: edgeCounts.filter((count) => count === 1).length,
        nonManifoldEdgeCount: edgeCounts.filter((count) => count > 2).length,
        centerOfMassZRatio: volumeAbs > 0 ? Math.max(0, Math.min(1, ((weightedZ / volumeAbs) - minZ) / height)) : 0.5,
        overhangArea45Cm2: overhang45Mm2 / 100,
        overhangArea60Cm2: overhang60Mm2 / 100,
    };
}

async function extractGeometry(file: File, settings: SlicerLiteSettings): Promise<MeshGeometry> {
    const buffer = await file.arrayBuffer();
    if (getExt(file.name) === '3mf') return parse3mf(buffer);
    const mesh = extractMeshFeatures(buffer, file.name, {
        printType: settings.printType,
        infill: settings.infill,
        layerHeight: settings.layerHeight,
    });
    return {
        source: 'slicer_lite_volume',
        volumeCm3: mesh.volume_cm3,
        surfaceAreaCm2: mesh.surfaceArea_cm2,
        bboxMm: mesh.boundingBox,
        triangleCount: mesh.triangleCount,
        centerOfMassZRatio: 0.5,
        overhangArea45Cm2: 0,
        overhangArea60Cm2: 0,
    };
}

export async function estimateSlicerLite(file: File, settings: SlicerLiteSettings): Promise<SlicerLiteQuote> {
    const quantity = Math.max(1, settings.quantity || 1);
    let geometry: MeshGeometry;
    try {
        geometry = await extractGeometry(file, settings);
    } catch (error) {
        return emptyFailedQuote(file, settings, error instanceof Error ? error.message : 'Không đọc được mesh từ file.');
    }

    const { x, y, z } = geometry.bboxMm;
    const bboxVolumeCm3 = Math.max(0, x * y * z / 1000);
    const estimatedVolumeCm3 = geometry.volumeCm3 > 0
        ? geometry.volumeCm3
        : bboxVolumeCm3 > 0
            ? bboxVolumeCm3 * 0.52
            : 0;
    const usedBboxVolumeFallback = geometry.volumeCm3 <= 0 && estimatedVolumeCm3 > 0;
    geometry = { ...geometry, source: usedBboxVolumeFallback ? 'slicer_lite_bbox_floor' : geometry.source, volumeCm3: estimatedVolumeCm3 };
    if (geometry.volumeCm3 <= 0 || bboxVolumeCm3 <= 0) {
        return emptyFailedQuote(file, settings, 'Không đọc được thể tích hoặc kích thước hợp lệ từ mesh.');
    }
    const fillRatio = bboxVolumeCm3 > 0 ? Math.min(1, geometry.volumeCm3 / bboxVolumeCm3) : 0;
    const minDim = Math.max(Math.min(x || 0.1, y || 0.1, z || 0.1), 0.1);
    const slenderness = Math.max(x, y, z) / minDim;
    const footprintCm2 = Math.max(x * y / 100, 0);
    const flatBaseAreaProxy = footprintCm2 > 0 ? Math.min(1, (geometry.volumeCm3 / Math.max(z / 10, 0.1)) / footprintCm2) : 0;
    const thinWallProxy = geometry.volumeCm3 > 0 ? Math.min(1, geometry.surfaceAreaCm2 / (geometry.volumeCm3 * 10)) : 0;
    const smallDetailProxy = geometry.triangleCount > 0 ? Math.min(1, geometry.triangleCount / Math.max(geometry.volumeCm3 * 1800, 1)) : 0;
    const overhangArea45Cm2 = geometry.overhangArea45Cm2 || 0;
    const overhangArea60Cm2 = geometry.overhangArea60Cm2 || 0;
    const supportNeededRatio = geometry.surfaceAreaCm2 > 0
        ? Math.min(0.55, (overhangArea45Cm2 / geometry.surfaceAreaCm2) * 0.8 + (slenderness > 3 ? 0.08 : 0))
        : (slenderness > 3 ? 0.12 : 0);
    const supportVolumeCm3 = settings.printType === 'fdm'
        ? geometry.volumeCm3 * supportNeededRatio * 0.35
        : geometry.volumeCm3 * supportNeededRatio * 0.22;

    const referenceInfillRatio = 0.2;
    const density = DENSITY[settings.printType];
    const shellFactor = Math.min(0.38, 0.18 + thinWallProxy * 0.08 + (geometry.surfaceAreaCm2 / Math.max(geometry.volumeCm3 * 100, 1)) * 0.1);
    const modelMassG = settings.printType === 'fdm'
        ? geometry.volumeCm3 * (shellFactor + referenceInfillRatio) * density
        : geometry.volumeCm3 * 1.25 * density;
    const supportMassG = supportVolumeCm3 * density;
    const totalMaterialG = Math.max(0, (modelMassG + supportMassG) * quantity);
    const complexityTimeFactor = 1 + thinWallProxy * 0.3 + smallDetailProxy * 0.35 + supportNeededRatio * 0.45;
    const referenceLayerFactor = 1;
    const speed = settings.printType === 'fdm' ? FDM_FLOW_G_PER_HOUR : RESIN_EFFECTIVE_G_PER_HOUR;
    const printTimeMinutes = totalMaterialG > 0 ? (totalMaterialG / speed) * 60 * referenceLayerFactor * complexityTimeFactor : 0;
    const priceBreakdown = calculatePrintingPrice({
        technology: settings.printType,
        grams: totalMaterialG,
        timeHours: printTimeMinutes / 60,
        infill: settings.infill,
        layerHeight: settings.layerHeight,
        quantity: 1,
    });
    const materialCost = priceBreakdown.materialCost;
    const machineTimeCost = priceBreakdown.machineCost;
    const complexityCost = 0;
    const price = priceBreakdown.total;
    const confidence = geometry.volumeCm3 > 0
        ? Math.max(0.45, Math.min(0.82, 0.72 - supportNeededRatio * 0.12 - (geometry.openBoundaryEdgeCount ? 0.08 : 0)))
        : 0.2;

    const warnings: SlicerLiteQuote['warnings'] = [];
    const evidence: SlicerLiteQuote['evidence'] = [{
        ruleId: 'PRICE_VOLUME_MASS_TIME_V1',
        sourceId: 'community_cost_volume_material_time',
        featureIds: ['volumeCm3', 'totalMaterialG', 'printTimeMinutes', 'supportVolumeCm3'],
        note: 'Giá dựa trên thể tích, vật liệu, thời gian máy, độ phức tạp và support ước lượng.',
    }];

    if (supportNeededRatio > 0.18) {
        warnings.push({ code: 'SUPPORT_LIKELY', severity: 'medium', message: 'Mô hình có dấu hiệu cần support đáng kể.', ruleId: 'SUPPORT_OVERHANG_PROXY_V1', sourceId: 'community_overhang_support' });
        evidence.push({ ruleId: 'SUPPORT_OVERHANG_PROXY_V1', sourceId: 'community_overhang_support', featureIds: ['overhangArea45Cm2', 'supportNeededRatio', 'slenderness'], note: 'Ước lượng support từ overhang và hình dáng cao/mảnh.' });
    }
    if (thinWallProxy > 0.65) warnings.push({ code: 'THIN_DETAIL_RISK', severity: 'medium', message: 'Bề mặt/thể tích cao, có thể có chi tiết mỏng hoặc khó in.', ruleId: 'THIN_WALL_PROXY_V1', sourceId: 'community_wall_thickness' });
    if (slenderness > 5) warnings.push({ code: 'TALL_SLENDER_RISK', severity: 'medium', message: 'Mô hình cao/mảnh, cần cân nhắc orientation/support.', ruleId: 'SLENDERNESS_STABILITY_V1', sourceId: 'community_orientation_stability' });
    if ((geometry.openBoundaryEdgeCount || 0) > 0 || (geometry.nonManifoldEdgeCount || 0) > 0) warnings.push({ code: 'MESH_HEALTH_RISK', severity: 'high', message: 'Mesh có cạnh hở hoặc non-manifold, nên sửa file trước khi in.', ruleId: 'MESH_HEALTH_EDGES_V1', sourceId: 'community_non_manifold' });
    if (usedBboxVolumeFallback) {
        warnings.push({ code: 'BBOX_VOLUME_ESTIMATE', severity: 'low', message: 'Không đọc được thể tích kín, hệ thống ước lượng theo hộp bao mô hình.', ruleId: 'BBOX_VOLUME_FALLBACK_V1', sourceId: 'miniver_volume_estimate' });
        evidence.push({ ruleId: 'BBOX_VOLUME_FALLBACK_V1', sourceId: 'miniver_volume_estimate', featureIds: ['bboxVolumeCm3', 'fillRatio'], note: 'Fallback cho STL/OBJ có signed volume bằng 0 nhưng vẫn có kích thước hình học.' });
    }

    return {
        source: geometry.source,
        priceStatus: usedBboxVolumeFallback ? 'estimated_from_bbox' : 'priced',
        geometryStatus: usedBboxVolumeFallback ? 'estimated_from_bbox' : 'valid',
        confidence: round(confidence, 2),
        volumeCm3: round(geometry.volumeCm3, 2),
        surfaceAreaCm2: round(geometry.surfaceAreaCm2, 2),
        bboxMm: { x: round(x, 1), y: round(y, 1), z: round(z, 1) },
        bboxVolumeCm3: round(bboxVolumeCm3, 2),
        fillRatio: round(fillRatio, 3),
        triangleCount: geometry.triangleCount,
        edgeCount: geometry.edgeCount || 0,
        nonManifoldEdgeCount: geometry.nonManifoldEdgeCount || 0,
        openBoundaryEdgeCount: geometry.openBoundaryEdgeCount || 0,
        duplicateVertexRatio: 0,
        slenderness: round(slenderness, 2),
        flatBaseAreaProxy: round(flatBaseAreaProxy, 3),
        centerOfMassZRatio: round(geometry.centerOfMassZRatio ?? 0.5, 3),
        thinWallProxy: round(thinWallProxy, 3),
        smallDetailProxy: round(smallDetailProxy, 3),
        overhangArea45Cm2: round(overhangArea45Cm2, 2),
        overhangArea60Cm2: round(overhangArea60Cm2, 2),
        supportNeededRatio: round(supportNeededRatio, 3),
        supportVolumeCm3: round(supportVolumeCm3, 2),
        supportMassG: Math.round(supportMassG * quantity),
        modelMassG: Math.round(modelMassG * quantity),
        totalMaterialG: Math.round(totalMaterialG),
        printTimeMinutes: Math.round(printTimeMinutes),
        price,
        pricing: { materialCost: Math.round(materialCost), machineTimeCost: Math.round(machineTimeCost), complexityCost: Math.round(complexityCost), minimumApplied: false, infillMultiplier: priceBreakdown.infillMultiplier, formulaVersion: priceBreakdown.formulaVersion },
        warnings,
        evidence,
        features: {
            printType: settings.printType,
            infill: settings.infill,
            layerHeight: settings.layerHeight,
            fileName: file.name,
            fileSize: file.size,
        },
    };
}
