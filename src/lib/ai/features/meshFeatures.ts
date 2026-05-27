import type { MeshFeatures } from '../types/print-ai';

interface ParsedMesh {
    volume: number;
    surfaceArea: number;
    triangleCount: number;
    boundingBox: { x: number; y: number; z: number };
}

function parseBinarySTL(buffer: ArrayBuffer): ParsedMesh {
    const view = new DataView(buffer);
    const numTriangles = view.getUint32(80, true);

    let volume = 0;
    let surfaceArea = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < numTriangles; i++) {
        const offset = 84 + i * 50;

        const v1x = view.getFloat32(offset + 12, true);
        const v1y = view.getFloat32(offset + 16, true);
        const v1z = view.getFloat32(offset + 20, true);

        const v2x = view.getFloat32(offset + 24, true);
        const v2y = view.getFloat32(offset + 28, true);
        const v2z = view.getFloat32(offset + 32, true);

        const v3x = view.getFloat32(offset + 36, true);
        const v3y = view.getFloat32(offset + 40, true);
        const v3z = view.getFloat32(offset + 44, true);

        minX = Math.min(minX, v1x, v2x, v3x);
        minY = Math.min(minY, v1y, v2y, v3y);
        minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x);
        maxY = Math.max(maxY, v1y, v2y, v3y);
        maxZ = Math.max(maxZ, v1z, v2z, v3z);

        const crossX = (v2y - v1y) * (v3z - v1z) - (v2z - v1z) * (v3y - v1y);
        const crossY = (v2z - v1z) * (v3x - v1x) - (v2x - v1x) * (v3z - v1z);
        const crossZ = (v2x - v1x) * (v3y - v1y) - (v2y - v1y) * (v3x - v1x);
        const triArea = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) / 2;
        surfaceArea += triArea;

        const dotX = v2y * v3z - v2z * v3y;
        const dotY = v2z * v3x - v2x * v3z;
        const dotZ = v2x * v3y - v2y * v3x;
        volume += (v1x * dotX + v1y * dotY + v1z * dotZ) / 6;
    }

    return {
        volume: Math.abs(volume),
        surfaceArea,
        triangleCount: numTriangles,
        boundingBox: {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ,
        },
    };
}

function parseAsciiSTL(buffer: ArrayBuffer): ParsedMesh {
    const text = new TextDecoder().decode(buffer);
    const vertexRegex = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/gi;

    const vertices: [number, number, number][] = [];
    let match: RegExpExecArray | null;
    while ((match = vertexRegex.exec(text)) !== null) {
        vertices.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
    }

    let volume = 0;
    let surfaceArea = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i + 2 < vertices.length; i += 3) {
        const [v1x, v1y, v1z] = vertices[i];
        const [v2x, v2y, v2z] = vertices[i + 1];
        const [v3x, v3y, v3z] = vertices[i + 2];

        minX = Math.min(minX, v1x, v2x, v3x);
        minY = Math.min(minY, v1y, v2y, v3y);
        minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x);
        maxY = Math.max(maxY, v1y, v2y, v3y);
        maxZ = Math.max(maxZ, v1z, v2z, v3z);

        const crossX = (v2y - v1y) * (v3z - v1z) - (v2z - v1z) * (v3y - v1y);
        const crossY = (v2z - v1z) * (v3x - v1x) - (v2x - v1x) * (v3z - v1z);
        const crossZ = (v2x - v1x) * (v3y - v1y) - (v2y - v1y) * (v3x - v1x);
        const triArea = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) / 2;
        surfaceArea += triArea;

        const dotX = v2y * v3z - v2z * v3y;
        const dotY = v2z * v3x - v2x * v3z;
        const dotZ = v2x * v3y - v2y * v3x;
        volume += (v1x * dotX + v1y * dotY + v1z * dotZ) / 6;
    }

    return {
        volume: Math.abs(volume),
        surfaceArea,
        triangleCount: Math.floor(vertices.length / 3),
        boundingBox: {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ,
        },
    };
}

function parseOBJ(buffer: ArrayBuffer): ParsedMesh {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split('\n');
    const verts: [number, number, number][] = [];
    const faces: number[][] = [];

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') {
            verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (parts[0] === 'f') {
            const indices = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
            for (let i = 1; i + 1 < indices.length; i++) {
                faces.push([indices[0], indices[i], indices[i + 1]]);
            }
        }
    }

    let volume = 0;
    let surfaceArea = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const [i0, i1, i2] of faces) {
        if (!verts[i0] || !verts[i1] || !verts[i2]) continue;
        const [v1x, v1y, v1z] = verts[i0];
        const [v2x, v2y, v2z] = verts[i1];
        const [v3x, v3y, v3z] = verts[i2];

        minX = Math.min(minX, v1x, v2x, v3x);
        minY = Math.min(minY, v1y, v2y, v3y);
        minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x);
        maxY = Math.max(maxY, v1y, v2y, v3y);
        maxZ = Math.max(maxZ, v1z, v2z, v3z);

        const crossX = (v2y - v1y) * (v3z - v1z) - (v2z - v1z) * (v3y - v1y);
        const crossY = (v2z - v1z) * (v3x - v1x) - (v2x - v1x) * (v3z - v1z);
        const crossZ = (v2x - v1x) * (v3y - v1y) - (v2y - v1y) * (v3x - v1x);
        surfaceArea += Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ) / 2;

        const dotX = v2y * v3z - v2z * v3y;
        const dotY = v2z * v3x - v2x * v3z;
        const dotZ = v2x * v3y - v2y * v3x;
        volume += (v1x * dotX + v1y * dotY + v1z * dotZ) / 6;
    }

    return {
        volume: Math.abs(volume),
        surfaceArea,
        triangleCount: faces.length,
        boundingBox: {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ,
        },
    };
}

export interface ExtractFeaturesOptions {
    printType: 'fdm' | 'resin';
    infill: string;
    layerHeight: string;
}

export interface ExtractFeaturesResult {
    features: MeshFeatures;
    volume_cm3: number;
    surfaceArea_cm2: number;
    boundingBox: { x: number; y: number; z: number };
    triangleCount: number;
}

export function extractMeshFeatures(
    buffer: ArrayBuffer,
    fileName: string,
    opts: ExtractFeaturesOptions,
): ExtractFeaturesResult {
    const lowerName = fileName.toLowerCase();
    let mesh: ParsedMesh;

    if (lowerName.endsWith('.obj')) {
        mesh = parseOBJ(buffer);
    } else {
        const view = new DataView(buffer);
        const binaryTriangleCount = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
        const expectedBinarySize = 84 + binaryTriangleCount * 50;
        const looksBinary = buffer.byteLength >= 84 && binaryTriangleCount > 0 && Math.abs(buffer.byteLength - expectedBinarySize) <= 4;
        const headerView = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
        const header = String.fromCharCode(...headerView).toLowerCase();
        if (header.startsWith('solid') && !looksBinary) {
            mesh = parseAsciiSTL(buffer);
        } else {
            mesh = parseBinarySTL(buffer);
        }
    }

    const volume_mm3 = mesh.volume;
    const volume_cm3 = volume_mm3 / 1000;
    const surfaceArea_mm2 = mesh.surfaceArea;
    const surfaceArea_cm2 = surfaceArea_mm2 / 100;

    const { x: bx, y: by, z: bz } = mesh.boundingBox;
    const bboxVol_mm3 = bx * by * bz;
    const fill_ratio = bboxVol_mm3 > 0 ? Math.min(volume_mm3 / bboxVol_mm3, 1) : 0;

    const maxDim = Math.max(bx, by, bz);
    const minDim = Math.max(Math.min(bx, by, bz), 0.1);
    const slenderness = maxDim / minDim;

    const footprint = Math.max(bx, by);
    const support_proxy = footprint > 0 && bz / footprint > 2.5 ? 1 : 0;

    const thin_part_proxy = volume_cm3 > 0
        ? Math.min(surfaceArea_cm2 / (volume_cm3 * 10), 1)
        : 0;

    const infillMap: Record<string, number> = {
        '15%': 0.15, '20%': 0.20, '30%': 0.30, '50%': 0.50,
    };
    const infill_pct = infillMap[opts.infill] ?? 0.20;

    const layerMap: Record<string, number> = {
        '0.2': 0.20, '0.12': 0.12, '0.08': 0.08,
    };
    const layer_height = layerMap[opts.layerHeight] ?? 0.20;

    const features: MeshFeatures = {
        volume_cm3: Math.round(volume_cm3 * 100) / 100,
        bbox_x: Math.round(bx * 10) / 10,
        bbox_y: Math.round(by * 10) / 10,
        bbox_z: Math.round(bz * 10) / 10,
        surface_area: Math.round(surfaceArea_cm2 * 100) / 100,
        triangle_count: mesh.triangleCount,
        fill_ratio: Math.round(fill_ratio * 1000) / 1000,
        slenderness: Math.round(slenderness * 100) / 100,
        support_proxy,
        thin_part_proxy: Math.round(thin_part_proxy * 1000) / 1000,
        material_fdm: opts.printType === 'fdm' ? 1 : 0,
        infill_pct,
        layer_height,
    };

    return {
        features,
        volume_cm3,
        surfaceArea_cm2,
        boundingBox: {
            x: Math.round(bx * 10) / 10,
            y: Math.round(by * 10) / 10,
            z: Math.round(bz * 10) / 10,
        },
        triangleCount: mesh.triangleCount,
    };
}
