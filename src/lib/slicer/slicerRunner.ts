import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SliceJobParams, FdmSlicerResult, ResinSlicerResult, SlicerResult } from './types';
import type { BoundingBox } from './types';
import { resolveProfile, type ProfileDefinition } from './profiles';
import { parseGcode, parseSl1Config, parseGcodeFilamentG, parseSl1MaterialMl, readZipEntry } from './outputParser';

const PRUSA_SLICER_BIN = 'prusa-slicer';

function parseBbox3MF(fileBuffer: Buffer): { bbox: BoundingBox; volumeCm3: number } {
    // 3MF files are ZIP archives; the model XML may live at '3D/3dmodel.model'
    // or, for PrusaSlicer exports, at '3D/3dmodel.model' or similar paths.
    const ZERO: { bbox: BoundingBox; volumeCm3: number } = {
        bbox: { x: 0, y: 0, z: 0 },
        volumeCm3: 0,
    };

    const xmlRaw = readZipEntry(fileBuffer, '3D/3dmodel.model');
    if (!xmlRaw) return ZERO; // graceful fallback — PrusaSlicer will handle it

    // Extract each <vertex .../> tag and pick x/y/z attributes regardless of order
    const vertTagReg = /<vertex\b([^>]*?)\/>/gi;

    const verts: [number, number, number][] = [];
    let vtag: RegExpExecArray | null;
    while ((vtag = vertTagReg.exec(xmlRaw)) !== null) {
        const attrs: Record<string, number> = {};
        let am: RegExpExecArray | null;
        const attrStr = vtag[1];
        const localReg = /\b(x|y|z)="([-\d.eE+]+)"/gi;
        while ((am = localReg.exec(attrStr)) !== null) {
            attrs[am[1].toLowerCase()] = parseFloat(am[2]);
        }
        if ('x' in attrs && 'y' in attrs && 'z' in attrs) {
            verts.push([attrs.x, attrs.y, attrs.z]);
        }
    }

    // Fallback: scan for any element with x/y/z attributes in any order
    if (verts.length === 0) {
        const anyAttrReg = /<[^>]+\bx="([-\d.eE+]+)"[^>]*\by="([-\d.eE+]+)"[^>]*\bz="([-\d.eE+]+)"/gi;
        let m: RegExpExecArray | null;
        while ((m = anyAttrReg.exec(xmlRaw)) !== null) {
            verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
        }
    }

    // If still no vertices, let PrusaSlicer handle it with zero stubs
    if (verts.length === 0) return ZERO;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [x, y, z] of verts) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    let volume = 0;
    const triReg = /<triangle\b[^>]*\bv1="(\d+)"[^>]*\bv2="(\d+)"[^>]*\bv3="(\d+)"/gi;
    let tm: RegExpExecArray | null;
    while ((tm = triReg.exec(xmlRaw)) !== null) {
        const i0 = parseInt(tm[1]), i1 = parseInt(tm[2]), i2 = parseInt(tm[3]);
        const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];
        if (!v0 || !v1 || !v2) continue;
        const cx = v1[1] * v2[2] - v1[2] * v2[1];
        const cy = v1[2] * v2[0] - v1[0] * v2[2];
        const cz = v1[0] * v2[1] - v1[1] * v2[0];
        volume += (v0[0] * cx + v0[1] * cy + v0[2] * cz) / 6;
    }

    return {
        bbox: {
            x: Math.round((maxX - minX) * 10) / 10,
            y: Math.round((maxY - minY) * 10) / 10,
            z: Math.round((maxZ - minZ) * 10) / 10,
        },
        volumeCm3: Math.abs(volume) / 1000,
    };
}

function parseBoundingBox(fileBuffer: Buffer, fileName: string): { bbox: BoundingBox; volumeCm3: number } {
    if (!fileName.toLowerCase().endsWith('.3mf')) {
        throw new Error('Chỉ hỗ trợ file .3mf. Vui lòng xuất model sang định dạng 3MF trước khi upload.');
    }
    return parseBbox3MF(fileBuffer);
}

function validateBuildVolume(bbox: BoundingBox, profile: ProfileDefinition): void {
    const vol = profile.buildVolumeMm;
    const dims: Array<{ label: string; model: number; limit: number }> = [
        { label: 'chiều rộng (X)', model: bbox.x, limit: vol.x },
        { label: 'chiều sâu (Y)',  model: bbox.y, limit: vol.y },
        { label: 'chiều cao (Z)',  model: bbox.z, limit: vol.z },
    ];
    const exceeded = dims.filter(d => d.model > d.limit + 0.1);
    if (exceeded.length > 0) {
        const details = exceeded
            .map(d => `${d.label}: ${d.model.toFixed(1)} mm (tối đa ${d.limit} mm, vượt ${(d.model - d.limit).toFixed(1)} mm)`)
            .join('; ');
        throw new Error(`Model vượt khổ in của máy ${profile.printerName}. ${details}.`);
    }
}

function isLikelyBinaryStl(buf: Buffer): boolean {
    if (buf.length < 84) return false;
    const numTri = buf.readUInt32LE(80);
    const expected = 84 + numTri * 50;
    return Math.abs(buf.length - expected) < 5;
}

function parseBboxBinarySTL(buf: Buffer): { bbox: BoundingBox; volumeCm3: number } {
    if (buf.length < 84) throw new Error('STL file too small');
    const n = buf.readUInt32LE(80);
    let volume = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < n; i++) {
        const o = 84 + i * 50;
        if (o + 50 > buf.length) break;
        const v1x = buf.readFloatLE(o + 12); const v1y = buf.readFloatLE(o + 16); const v1z = buf.readFloatLE(o + 20);
        const v2x = buf.readFloatLE(o + 24); const v2y = buf.readFloatLE(o + 28); const v2z = buf.readFloatLE(o + 32);
        const v3x = buf.readFloatLE(o + 36); const v3y = buf.readFloatLE(o + 40); const v3z = buf.readFloatLE(o + 44);
        minX = Math.min(minX, v1x, v2x, v3x); minY = Math.min(minY, v1y, v2y, v3y); minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x); maxY = Math.max(maxY, v1y, v2y, v3y); maxZ = Math.max(maxZ, v1z, v2z, v3z);
        const cx = v2y * v3z - v2z * v3y; const cy = v2z * v3x - v2x * v3z; const cz = v2x * v3y - v2y * v3x;
        volume += (v1x * cx + v1y * cy + v1z * cz) / 6;
    }

    return {
        bbox: { x: Math.round((maxX - minX) * 10) / 10, y: Math.round((maxY - minY) * 10) / 10, z: Math.round((maxZ - minZ) * 10) / 10 },
        volumeCm3: Math.abs(volume) / 1000,
    };
}

function parseBboxAsciiSTL(buf: Buffer): { bbox: BoundingBox; volumeCm3: number } {
    const text = buf.toString();
    const reg = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/gi;
    let m: RegExpExecArray | null;
    const verts: [number, number, number][] = [];
    while ((m = reg.exec(text)) !== null) {
        verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    }
    let volume = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i + 2 < verts.length; i += 3) {
        const [v1x, v1y, v1z] = verts[i]; const [v2x, v2y, v2z] = verts[i + 1]; const [v3x, v3y, v3z] = verts[i + 2];
        minX = Math.min(minX, v1x, v2x, v3x); minY = Math.min(minY, v1y, v2y, v3y); minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x); maxY = Math.max(maxY, v1y, v2y, v3y); maxZ = Math.max(maxZ, v1z, v2z, v3z);
        const cx = v2y * v3z - v2z * v3y; const cy = v2z * v3x - v2x * v3z; const cz = v2x * v3y - v2y * v3x;
        volume += (v1x * cx + v1y * cy + v1z * cz) / 6;
    }
    return {
        bbox: { x: Math.round((maxX - minX) * 10) / 10, y: Math.round((maxY - minY) * 10) / 10, z: Math.round((maxZ - minZ) * 10) / 10 },
        volumeCm3: Math.abs(volume) / 1000,
    };
}

function parseBboxOBJ(buf: Buffer): { bbox: BoundingBox; volumeCm3: number } {
    const lines = buf.toString().split('\n');
    const verts: [number, number, number][] = [];
    const faces: number[][] = [];
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        else if (parts[0] === 'f') {
            const idx = parts.slice(1).map((p) => parseInt(p.split('/')[0]) - 1);
            for (let i = 1; i + 1 < idx.length; i++) faces.push([idx[0], idx[i], idx[i + 1]]);
        }
    }
    let volume = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const [i0, i1, i2] of faces) {
        if (!verts[i0] || !verts[i1] || !verts[i2]) continue;
        const [v1x, v1y, v1z] = verts[i0]; const [v2x, v2y, v2z] = verts[i1]; const [v3x, v3y, v3z] = verts[i2];
        minX = Math.min(minX, v1x, v2x, v3x); minY = Math.min(minY, v1y, v2y, v3y); minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x); maxY = Math.max(maxY, v1y, v2y, v3y); maxZ = Math.max(maxZ, v1z, v2z, v3z);
        const cx = v2y * v3z - v2z * v3y; const cy = v2z * v3x - v2x * v3z; const cz = v2x * v3y - v2y * v3x;
        volume += (v1x * cx + v1y * cy + v1z * cz) / 6;
    }
    return {
        bbox: { x: Math.round((maxX - minX) * 10) / 10, y: Math.round((maxY - minY) * 10) / 10, z: Math.round((maxZ - minZ) * 10) / 10 },
        volumeCm3: Math.abs(volume) / 1000,
    };
}

function runPrusaSlicerFdm(
    modelPath: string,
    iniPath: string,
    layerHeight: number,
    infill: number,
    support: boolean,
    gcodeOutPath: string,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const args = [
            '--load', iniPath,
            `--layer-height=${layerHeight}`,
            `--fill-density=${infill}%`,
            `--support-material=${support ? 1 : 0}`,
            `--support-material-auto=${support ? 1 : 0}`,
            '--export-gcode',
            '-o', gcodeOutPath,
            modelPath,
        ];

        const child = spawn(PRUSA_SLICER_BIN, args, {
            timeout: 120_000,
            env: { ...process.env, DISPLAY: '' },
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        child.on('close', (code) => {
            if (code === 0 && fs.existsSync(gcodeOutPath)) {
                resolve(gcodeOutPath);
            } else {
                reject(new Error(`PrusaSlicer FDM exited ${code}: ${(stdout + stderr).slice(-400)}`));
            }
        });
        child.on('error', (err) => reject(new Error(`Failed to spawn prusa-slicer: ${err.message}`)));
    });
}

function runPrusaSlicerSla(
    modelPath: string,
    iniPath: string,
    support: boolean,
    sl1OutPath: string,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const args = [
            '--load', iniPath,
            `--support-material=${support ? 1 : 0}`,
            '--export-sla',
            '-o', sl1OutPath,
            modelPath,
        ];

        const child = spawn(PRUSA_SLICER_BIN, args, {
            timeout: 300_000,
            env: { ...process.env, DISPLAY: '' },
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        child.on('close', (code) => {
            if (code === 0 && fs.existsSync(sl1OutPath)) {
                resolve(fs.readFileSync(sl1OutPath));
            } else {
                const detail = (stdout + stderr).slice(-600);
                if (detail.includes('fully inside the print volume') || detail.includes('Nothing to print')) {
                    reject(new Error('Mô hình quá lớn hoặc nằm ngoài khung in SLA. Vui lòng kiểm tra kích thước mô hình.'));
                } else {
                    reject(new Error(`PrusaSlicer SLA exited ${code}: ${detail}`));
                }
            }
        });
        child.on('error', (err) => reject(new Error(`Failed to spawn prusa-slicer: ${err.message}`)));
    });
}

export async function sliceModel(
    fileBuffer: Buffer,
    fileName: string,
    params: SliceJobParams,
): Promise<SlicerResult> {
    const profile = resolveProfile(params);

    const ext = path.extname(fileName).toLowerCase();
    if (ext !== '.3mf') {
        throw new Error('Chỉ hỗ trợ file .3mf. Vui lòng xuất model sang định dạng 3MF trước khi upload.');
    }

    const { bbox, volumeCm3 } = parseBoundingBox(fileBuffer, fileName);

    if (bbox.x > 0 || bbox.y > 0 || bbox.z > 0) {
        validateBuildVolume(bbox, profile);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slicer-'));
    const modelPath = path.join(tmpDir, `model${ext}`);

    try {
        fs.writeFileSync(modelPath, fileBuffer);

        if (profile.mode === 'resin') {
            const sl1OutPath = path.join(tmpDir, 'output.sl1');

            if (params.support) {
                const sl1NoSupportPath = path.join(tmpDir, 'model_only.sl1');
                const [sl1NoSupport, sl1WithSupport] = await Promise.all([
                    runPrusaSlicerSla(modelPath, profile.iniPath, false, sl1NoSupportPath),
                    runPrusaSlicerSla(modelPath, profile.iniPath, true, sl1OutPath),
                ]);
                const modelOnlyMl = parseSl1MaterialMl(sl1NoSupport);
                return parseSl1Config(sl1WithSupport, profile, bbox, volumeCm3, modelOnlyMl);
            }

            const sl1Buffer = await runPrusaSlicerSla(modelPath, profile.iniPath, false, sl1OutPath);
            return parseSl1Config(sl1Buffer, profile, bbox, volumeCm3);
        }

        const gcodeOutPath = path.join(tmpDir, 'output.gcode');

        if (params.support) {
            const gcodeNoSupportPath = path.join(tmpDir, 'model_only.gcode');
            const [gcodeNoSupport, gcodeWithSupport] = await Promise.all([
                runPrusaSlicerFdm(modelPath, profile.iniPath, params.layerHeight, params.infill, false, gcodeNoSupportPath),
                runPrusaSlicerFdm(modelPath, profile.iniPath, params.layerHeight, params.infill, true, gcodeOutPath),
            ]);
            const modelOnlyG = parseGcodeFilamentG(gcodeNoSupport);
            return parseGcode(gcodeOutPath, profile, bbox, volumeCm3, true, modelOnlyG) as FdmSlicerResult;
        }

        const gcodePath = await runPrusaSlicerFdm(modelPath, profile.iniPath, params.layerHeight, params.infill, false, gcodeOutPath);
        return parseGcode(gcodePath, profile, bbox, volumeCm3, false) as FdmSlicerResult;
    } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
}
