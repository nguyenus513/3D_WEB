import sharp from 'sharp';

/**
 * Apply a tiled watermark to an image buffer.
 * 
 * @param imageBuffer - The input image buffer.
 * @param text - The watermark text (default: "MINIVER3D - DEMO PREVIEW").
 * @returns A promise that resolves to the watermarked image buffer.
 */
export async function addWatermark(
    imageBuffer: Buffer,
    text: string = 'MINIVER3D - DEMO PREVIEW'
): Promise<Buffer> {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        const width = metadata.width || 1000;
        const height = metadata.height || 1000;

        // Create an SVG with the text repeated diagonally
        // We'll create a pattern that covers the entire image
        const svgWidth = width;
        const svgHeight = height;

        // Font size relative to image width
        const fontSize = Math.max(24, Math.floor(width / 20));
        const opacity = 0.15; // 15% opacity

        // Calculate repetition needed
        // We do a simple grid of text
        let svgContent = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
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

        // Composite the SVG over the image
        const outputBuffer = await image
            .composite([
                {
                    input: Buffer.from(svgContent),
                    top: 0,
                    left: 0,
                },
            ])
            .toBuffer();

        return outputBuffer;
    } catch (error) {
        console.error('Watermark failed:', error);
        // Fallback: return original image if watermarking fails
        return imageBuffer;
    }
}
