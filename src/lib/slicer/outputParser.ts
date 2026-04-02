import fs from 'fs';
import zlib from 'zlib';
import type { FdmSlicerResult, ResinSlicerResult, BoundingBox } from './types';
import type { ProfileDefinition } from './profiles';

function parseTimeToMinutes(timeStr: string): number {
    let totalMinutes = 0;

    const hourMatch = timeStr.match(/(\d+)h/);
    const minMatch = timeStr.match(/(\d+)m/);
    const secMatch = timeStr.match(/(\d+)s/);

    if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
    if (minMatch) totalMinutes += parseInt(minMatch[1]);
    if (secMatch) totalMinutes += parseInt(secMatch[1]) / 60;

    return Math.round(totalMinutes * 10) / 10;
}

export function readZipEntry(buf: Buffer, entryName: string): string | null {
    const EOCD_SIG = 0x06054b50;
    const CD_SIG = 0x02014b50;

    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
        if (buf.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
    }
    if (eocdOffset < 0) return null;

    const cdOffset = buf.readUInt32LE(eocdOffset + 16);
    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    let offset = cdOffset;

    while (offset + 46 <= cdOffset + cdSize) {
        if (buf.readUInt32LE(offset) !== CD_SIG) break;
        const nameLen = buf.readUInt16LE(offset + 28);
        const extraLen = buf.readUInt16LE(offset + 30);
        const commentLen = buf.readUInt16LE(offset + 32);
        const name = buf.slice(offset + 46, offset + 46 + nameLen).toString('utf8');
        const localOffset = buf.readUInt32LE(offset + 42);

        if (name === entryName) {
            const localNameLen = buf.readUInt16LE(localOffset + 26);
            const localExtraLen = buf.readUInt16LE(localOffset + 28);
            const compression = buf.readUInt16LE(localOffset + 8);
            const compSizeFromCd = buf.readUInt32LE(offset + 20);
            const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
            const compData = buf.slice(dataOffset, dataOffset + compSizeFromCd);

            if (compression === 0) return compData.toString('utf8');
            if (compression === 8) return zlib.inflateRawSync(compData).toString('utf8');
            return null;
        }

        offset += 46 + nameLen + extraLen + commentLen;
    }
    return null;
}

export function parseGcodeFilamentG(gcodePath: string): number {
    const content = fs.readFileSync(gcodePath, 'utf8');
    const match = content.match(/^; filament used \[g\] = ([\d.]+)/m);
    if (match) return parseFloat(match[1]);
    const fallback = content.match(/; total filament used \[g\] = ([\d.]+)/);
    return fallback ? parseFloat(fallback[1]) : 0;
}

export function parseSl1MaterialMl(sl1Buffer: Buffer): number {
    const raw = readZipEntry(sl1Buffer, 'config.json');
    if (!raw) return 0;
    try {
        const config = JSON.parse(raw) as { usedMaterial?: number };
        return config.usedMaterial ?? 0;
    } catch {
        return 0;
    }
}

export function parseGcode(
    gcodePath: string,
    profile: ProfileDefinition,
    bbox: BoundingBox,
    volumeCm3: number,
    supportEnabled: boolean,
    modelOnlyG?: number,
): FdmSlicerResult {
    const content = fs.readFileSync(gcodePath, 'utf8');
    const lines = content.split('\n');

    let totalMaterialG = 0;
    let printTimeMinutes = 0;
    let layerCount = 0;

    for (const line of lines) {
        if (line.startsWith('; filament used [g] = ')) {
            const val = parseFloat(line.replace('; filament used [g] = ', '').trim());
            if (Number.isFinite(val) && val > 0) {
                totalMaterialG = val;
            }
            continue;
        }

        if (line.startsWith('; estimated printing time (normal mode) = ')) {
            const timeStr = line.replace('; estimated printing time (normal mode) = ', '').trim();
            printTimeMinutes = parseTimeToMinutes(timeStr);
            continue;
        }

        if (line.trimEnd() === ';LAYER_CHANGE') {
            layerCount++;
        }
    }

    if (totalMaterialG === 0) {
        const fallbackMatch = content.match(/; total filament used \[g\] = ([\d.]+)/);
        if (fallbackMatch) {
            totalMaterialG = parseFloat(fallbackMatch[1]);
        }
    }

    const totalG = Math.round(totalMaterialG * 10) / 10;
    let mainMaterialG: number;
    let supportMaterialG: number;

    if (modelOnlyG !== undefined && supportEnabled) {
        mainMaterialG = Math.round(modelOnlyG * 10) / 10;
        supportMaterialG = Math.max(0, Math.round((totalG - mainMaterialG) * 10) / 10);
    } else {
        mainMaterialG = totalG;
        supportMaterialG = 0;
    }

    return {
        mode: 'fdm',
        bboxMm: bbox,
        volumeCm3: Math.round(volumeCm3 * 100) / 100,
        mainMaterialG,
        supportMaterialG,
        totalMaterialG: totalG,
        printTimeMinutes: Math.round(printTimeMinutes * 10) / 10,
        layerCount,
        source: 'prusaslicer_exact',
        profileId: profile.id,
    };
}

export function parseSl1Config(
    sl1Buffer: Buffer,
    profile: ProfileDefinition,
    bbox: BoundingBox,
    volumeCm3: number,
    modelOnlyMl?: number,
): ResinSlicerResult {
    const raw = readZipEntry(sl1Buffer, 'config.json');
    if (!raw) throw new Error('config.json not found in SL1 archive');

    const config = JSON.parse(raw) as {
        usedMaterial?: number;
        printTime?: number;
        numSlow?: number;
        numFast?: number;
    };

    const usedMaterialMl = config.usedMaterial ?? 0;
    const printTimeSec = config.printTime ?? 0;
    const numSlow = config.numSlow ?? 0;
    const numFast = config.numFast ?? 0;
    const layerCount = numSlow + numFast;

    const totalResinMl = Math.round(usedMaterialMl * 100) / 100;
    const totalResinG = Math.round(totalResinMl * profile.densityGPerCm3 * 10) / 10;
    const printTimeMinutes = Math.round((printTimeSec / 60) * 10) / 10;

    let mainResinMl: number;
    let supportResinMl: number;

    if (modelOnlyMl !== undefined) {
        mainResinMl = Math.round(modelOnlyMl * 100) / 100;
        supportResinMl = Math.max(0, Math.round((totalResinMl - mainResinMl) * 100) / 100);
    } else {
        mainResinMl = totalResinMl;
        supportResinMl = 0;
    }

    return {
        mode: 'resin',
        bboxMm: bbox,
        volumeCm3: Math.round(volumeCm3 * 100) / 100,
        mainResinMl,
        supportResinMl,
        totalResinMl,
        totalResinG,
        printTimeMinutes,
        layerCount,
        source: 'prusaslicer_exact',
        profileId: profile.id,
    };
}
