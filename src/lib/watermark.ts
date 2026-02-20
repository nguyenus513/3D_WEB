import sharp from 'sharp';

/**
 * Apply a tiled watermark to an image buffer.
 * 
 * For formats not natively supported by sharp (HEIC/HEIF/AVIF),
 * attempts to convert to JPEG first, then applies watermark.
 * If all processing fails, returns original buffer unchanged.
 * 
 * @param imageBuffer - The input image buffer.
 * @param text - The watermark text (default: "MINIVER3D - DEMO PREVIEW").
 * @returns A promise that resolves to the watermarked image buffer.
 */
export async function addWatermark(
    imageBuffer: Buffer,
    text: string = 'miniver3D'
): Promise<Buffer> {
    try {
        let processableBuffer = imageBuffer;
        let image = sharp(processableBuffer);
        let metadata = await image.metadata().catch(() => null);

        // If sharp can't read the format (e.g. HEIF without codec),
        // skip watermark and return original
        if (!metadata) {
            console.warn('[Watermark] Cannot read image metadata, skipping watermark');
            return imageBuffer;
        }

        const width = metadata.width || 1000;
        const height = metadata.height || 1000;

        // Font size relative to image width
        const fontSize = Math.max(24, Math.floor(width / 20));
        const opacity = 0.15;

        const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <style>
                .text {
                    fill: white;
                    font-family: sans-serif;
                    font-weight: bold;
                    font-size: ${fontSize}px;
                    opacity: ${opacity};
                }
            </style>
            <defs>
                <pattern id="watermark-pattern" x="0" y="0" width="${fontSize * 10}" height="${fontSize * 5}" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                     <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="text">${text}</text>
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#watermark-pattern)" />
        </svg>`;

        // Try to composite watermark; convert to JPEG if format isn't supported for output
        const outputBuffer = await image
            .composite([
                {
                    input: Buffer.from(svgContent),
                    top: 0,
                    left: 0,
                },
            ])
            .jpeg({ quality: 90 })
            .toBuffer();

        return outputBuffer;
    } catch (error) {
        console.warn('[Watermark] Failed, returning original image:', (error as Error).message);
        // Fallback: return original image if watermarking fails
        return imageBuffer;
    }
}
