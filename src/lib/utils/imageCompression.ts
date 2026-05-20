export interface ImageCompressionOptions {
    maxBytes?: number;
    maxDimension?: number;
    initialQuality?: number;
    minQuality?: number;
    qualityStep?: number;
    outputType?: 'image/jpeg' | 'image/webp';
}

export interface ImageCompressionResult {
    file: File;
    compressed: boolean;
    originalBytes: number;
    outputBytes: number;
    width?: number;
    height?: number;
}

export const DEFAULT_IMAGE_UPLOAD_MAX_BYTES = 3.5 * 1024 * 1024;
export const DEFAULT_IMAGE_MAX_DIMENSION = 1600;

const SKIP_COMPRESSION_TYPES = new Set(['image/gif', 'image/svg+xml']);

function shouldCompressImage(file: File, maxBytes: number): boolean {
    return file.size > maxBytes && file.type.startsWith('image/') && !SKIP_COMPRESSION_TYPES.has(file.type);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Không thể đọc ảnh. Vui lòng thử ảnh JPG/PNG khác.'));
        };
        image.src = url;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function getOutputName(fileName: string, outputType: string): string {
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'custom-image';
    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
    return `${baseName}.${extension}`;
}

export async function compressImageForUpload(
    file: File,
    options: ImageCompressionOptions = {}
): Promise<ImageCompressionResult> {
    const maxBytes = options.maxBytes ?? DEFAULT_IMAGE_UPLOAD_MAX_BYTES;
    const maxDimension = options.maxDimension ?? DEFAULT_IMAGE_MAX_DIMENSION;
    const outputType = options.outputType ?? 'image/jpeg';
    const initialQuality = options.initialQuality ?? 0.82;
    const minQuality = options.minQuality ?? 0.55;
    const qualityStep = options.qualityStep ?? 0.08;

    if (!shouldCompressImage(file, maxBytes)) {
        return {
            file,
            compressed: false,
            originalBytes: file.size,
            outputBytes: file.size,
        };
    }

    const image = await loadImageFromFile(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
        return {
            file,
            compressed: false,
            originalBytes: file.size,
            outputBytes: file.size,
            width: image.width,
            height: image.height,
        };
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = initialQuality;
    let blob = await canvasToBlob(canvas, outputType, quality);

    while (blob && blob.size > maxBytes && quality > minQuality) {
        quality = Math.max(minQuality, quality - qualityStep);
        blob = await canvasToBlob(canvas, outputType, quality);
    }

    if (!blob || blob.size >= file.size) {
        return {
            file,
            compressed: false,
            originalBytes: file.size,
            outputBytes: file.size,
            width: canvas.width,
            height: canvas.height,
        };
    }

    const compressedFile = new File([blob], getOutputName(file.name, outputType), {
        type: outputType,
        lastModified: Date.now(),
    });

    return {
        file: compressedFile,
        compressed: true,
        originalBytes: file.size,
        outputBytes: compressedFile.size,
        width: canvas.width,
        height: canvas.height,
    };
}

export async function prepareImageForServerUpload(
    file: File,
    options: ImageCompressionOptions = {}
): Promise<ImageCompressionResult> {
    const maxBytes = options.maxBytes ?? DEFAULT_IMAGE_UPLOAD_MAX_BYTES;
    const result = await compressImageForUpload(file, { ...options, maxBytes });

    if (result.file.size > maxBytes) {
        throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 4MB hoặc dùng ảnh JPG/PNG đã nén.');
    }

    return result;
}
