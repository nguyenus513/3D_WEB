import { NextRequest, NextResponse } from 'next/server';

/**
 * STL Analysis API
 * Calculates volume, weight, and estimated print time from STL files
 * 
 * Uses node-stl library for parsing binary/ASCII STL files
 */

// Material density (g/cm³)
// PLA: 1.24 g/cm³, Standard Resin: 1.1-1.2 g/cm³
const DENSITY: Record<string, number> = {
    fdm: 1.24,
    resin: 1.1,
};

// Shell factor for FDM
const SHELL_FACTOR = 1.2;
// Support/Waste factor for Resin
const RESIN_FACTOR = 1.25;

// Infill factor - FDM uses ~20% infill (shell + infill ≈ 30% of solid volume)
// Resin is always 100% solid
// Infill percentage (0-1)
const INFILL_RATIO: Record<string, number> = {
    fdm: 0.20,   // Default 20% for initial analysis
    resin: 1.0,
};

// Average print speed (g/hour) - actual material printed per hour
const PRINT_SPEED: Record<string, number> = {
    fdm: 12,     // ~12g/hour for FDM (with infill)
    resin: 6,    // ~6g/hour for Resin (solid, slower)
};

/**
 * Parse STL file and calculate volume
 * Supports both binary and ASCII STL formats
 */
function parseSTL(buffer: Buffer): { volume: number; boundingBox: { x: number; y: number; z: number } } {
    // Method 1: File Size Check (Most reliable for Binary)
    // Binary STL has 84 byte header + 50 bytes per triangle
    if (buffer.length >= 84) {
        const numTriangles = buffer.readUInt32LE(80);
        const expectedSize = 84 + numTriangles * 50;

        // precise match or close match (sometimes file has extra trailing bytes)
        if (buffer.length === expectedSize || Math.abs(buffer.length - expectedSize) < 5) {
            return parseBinarySTL(buffer);
        }
    }

    // Method 2: 'solid' keyword check (Traditional ASCII check)
    // Many binary STLs unfortunately start with "solid" in the header text
    // So we only use this if Method 1 didn't match a binary size
    const startStr = buffer.slice(0, 5).toString().toLowerCase();
    if (startStr.startsWith('solid')) {
        return parseAsciiSTL(buffer);
    }

    // Fallback: Default to Binary
    return parseBinarySTL(buffer);
}

function parseBinarySTL(buffer: Buffer): { volume: number; boundingBox: { x: number; y: number; z: number } } {
    // Binary STL format:
    // 80 bytes header
    // 4 bytes: number of triangles
    // For each triangle:
    //   12 bytes: normal vector (3 floats)
    //   36 bytes: 3 vertices (9 floats)
    //   2 bytes: attribute byte count

    const numTriangles = buffer.readUInt32LE(80);
    let volume = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < numTriangles; i++) {
        const offset = 84 + i * 50; // 84 = header + count, 50 = triangle size

        // Skip normal (12 bytes), read 3 vertices
        const v1x = buffer.readFloatLE(offset + 12);
        const v1y = buffer.readFloatLE(offset + 16);
        const v1z = buffer.readFloatLE(offset + 20);

        const v2x = buffer.readFloatLE(offset + 24);
        const v2y = buffer.readFloatLE(offset + 28);
        const v2z = buffer.readFloatLE(offset + 32);

        const v3x = buffer.readFloatLE(offset + 36);
        const v3y = buffer.readFloatLE(offset + 40);
        const v3z = buffer.readFloatLE(offset + 44);

        // Update bounding box
        minX = Math.min(minX, v1x, v2x, v3x);
        minY = Math.min(minY, v1y, v2y, v3y);
        minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x);
        maxY = Math.max(maxY, v1y, v2y, v3y);
        maxZ = Math.max(maxZ, v1z, v2z, v3z);

        // Signed volume of tetrahedron formed with origin
        // V = (1/6) * |v1 · (v2 × v3)|
        const cross = {
            x: v2y * v3z - v2z * v3y,
            y: v2z * v3x - v2x * v3z,
            z: v2x * v3y - v2y * v3x,
        };

        volume += (v1x * cross.x + v1y * cross.y + v1z * cross.z) / 6;
    }

    return {
        volume: Math.abs(volume), // mm³
        boundingBox: {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ,
        },
    };
}

function parseAsciiSTL(buffer: Buffer): { volume: number; boundingBox: { x: number; y: number; z: number } } {
    const text = buffer.toString();
    const vertexRegex = /vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi;

    const vertices: [number, number, number][] = [];
    let match;

    while ((match = vertexRegex.exec(text)) !== null) {
        vertices.push([
            parseFloat(match[1]),
            parseFloat(match[2]),
            parseFloat(match[3]),
        ]);
    }

    let volume = 0;
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        if (i + 2 >= vertices.length) break;

        const [v1x, v1y, v1z] = vertices[i];
        const [v2x, v2y, v2z] = vertices[i + 1];
        const [v3x, v3y, v3z] = vertices[i + 2];

        minX = Math.min(minX, v1x, v2x, v3x);
        minY = Math.min(minY, v1y, v2y, v3y);
        minZ = Math.min(minZ, v1z, v2z, v3z);
        maxX = Math.max(maxX, v1x, v2x, v3x);
        maxY = Math.max(maxY, v1y, v2y, v3y);
        maxZ = Math.max(maxZ, v1z, v2z, v3z);

        const cross = {
            x: v2y * v3z - v2z * v3y,
            y: v2z * v3x - v2x * v3z,
            z: v2x * v3y - v2y * v3x,
        };

        volume += (v1x * cross.x + v1y * cross.y + v1z * cross.z) / 6;
    }

    return {
        volume: Math.abs(volume),
        boundingBox: {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ,
        },
    };
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const printType = (formData.get('type') as string) || 'fdm';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.stl') && !fileName.endsWith('.obj')) {
            return NextResponse.json({
                error: 'Invalid file type. Only STL and OBJ files are supported.'
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = parseSTL(buffer);

        // Volume in cm³ (STL is typically in mm, so divide by 1000)
        const volumeCm3 = result.volume / 1000;

        // Calculate weight based on new formula
        const density = DENSITY[printType] || DENSITY.fdm;
        let grams: number;

        if (printType === 'fdm') {
            const infillRatio = INFILL_RATIO.fdm;
            // Formula: Vin = Vmodel * (shell_factor + infill)
            // Mass = Vin * density
            const vIn = volumeCm3 * (SHELL_FACTOR + infillRatio);
            grams = vIn * density;
        } else {
            // Formula: Vreal = Vmodel * k (k=1.25)
            // Mass = Vreal * density
            const vReal = volumeCm3 * RESIN_FACTOR;
            grams = vReal * density;
        }

        // Estimate print time based on weight and print speed
        const speed = PRINT_SPEED[printType] || PRINT_SPEED.fdm;
        const hours = grams / speed;

        // Calculate price
        let price: number;
        if (printType === 'fdm') {
            // FDM: 600 × gram + 3000 × hour
            price = 600 * grams + 3000 * hours;
        } else {
            // Resin: 3000 × hour + 3000 × gram
            price = 3000 * hours + 3000 * grams;
        }

        return NextResponse.json({
            success: true,
            volume: Math.round(volumeCm3 * 100) / 100,  // Round to 2 decimals
            grams: Math.round(grams),
            hours: Math.round(hours * 10) / 10,          // Round to 1 decimal
            price: Math.round(price),
            boundingBox: {
                x: Math.round(result.boundingBox.x * 10) / 10,
                y: Math.round(result.boundingBox.y * 10) / 10,
                z: Math.round(result.boundingBox.z * 10) / 10,
            },
        });
    } catch (error) {
        console.error('STL analysis error:', error);
        return NextResponse.json({
            error: 'Failed to analyze file: ' + (error as Error).message
        }, { status: 500 });
    }
}
