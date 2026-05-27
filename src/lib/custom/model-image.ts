import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { uploadToR2 } from '@/lib/storage/r2';

export interface CustomModelImageDraft {
  characterIndex: number;
  prompt: string;
  extraDescription?: string;
  glassesDescription?: string;
  hatDescription?: string;
  previewUrl?: string;
  mainImageUrl?: string;
  glassesImageUrl?: string;
  hatImageUrl?: string;
  approved?: boolean;
  generatedModelImage?: { url: string; key: string; fileId?: string } | null;
}

type ImageInput = { name: string; data: string };

const IMAGE_MODEL = process.env.PRINT_IMAGE_MODEL || 'cx/gpt-5.5-image';
const IMAGE_MODEL_FALLBACK = process.env.PRINT_IMAGE_FALLBACK_MODEL || 'cx/gpt-5.5-image';
let demoReferenceCache: ImageInput | null = null;

function getBaseUrl() {
  return (process.env.PRINT_LLM_BASE_URL || process.env.OPENAI_BASE_URL || '').replace(/\/$/, '');
}

function getApiKey() {
  return process.env.PRINT_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function asDataUrl(buffer: Buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function compressImage(buffer: Buffer, maxSize: number) {
  return sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function getDemoReferenceImage(): Promise<ImageInput> {
  if (demoReferenceCache) return demoReferenceCache;
  const buffer = await fs.readFile(path.join(process.cwd(), 'img', 'miniver', 'demo.png'));
  const compressed = await compressImage(buffer, 1024);
  demoReferenceCache = { name: 'miniver-demo-reference.jpg', data: asDataUrl(compressed, 'image/jpeg') };
  return demoReferenceCache;
}

export async function fileToImageInput(file: File, name: string): Promise<ImageInput> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const compressed = await compressImage(buffer, 1280);
  return { name: `${name}.jpg`, data: asDataUrl(compressed, 'image/jpeg') };
}

async function fetchImageAsInput(url: string | undefined, name: string): Promise<ImageInput | null> {
  if (!url) return null;
  const absoluteUrl = url.startsWith('/') ? `${getAppUrl()}${url}` : url;
  const response = await fetch(absoluteUrl, { cache: 'no-store' });
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  const compressed = contentType.startsWith('image/') ? await compressImage(buffer, 1280) : buffer;
  return { name: `${name}.jpg`, data: asDataUrl(compressed, 'image/jpeg') };
}

export function buildCustomModelPrompt(input: {
  extraDescription?: string;
  glassesDescription?: string;
  hatDescription?: string;
  hasGlassesImage?: boolean;
  hasHatImage?: boolean;
}) {
  const details = [
    input.extraDescription ? `User extra description: ${input.extraDescription}` : '',
    input.glassesDescription ? `Glasses text description: ${input.glassesDescription}` : '',
    input.hatDescription ? `Hat text description: ${input.hatDescription}` : '',
    input.hasGlassesImage ? 'A glasses reference image is provided; use it as the primary glasses reference.' : '',
    input.hasHatImage ? 'A hat reference image is provided; use it as the primary hat reference.' : '',
  ].filter(Boolean).join('\n');

  return [
    'Create one cute collectible chibi 3D figurine image.',
    'STRICT TEMPLATE: use the provided miniver-demo-reference image as the fixed figurine template. Keep the same full-body framing, character scale, oversized head/small body ratio, toy-like 3D printed resin/plastic render, clean studio background, and full hands/feet visible.',
    'IDENTITY: use the user photo only for face likeness, hairstyle, outfit direction, and personal details.',
    'ONLY allowed changes: face likeness, hair, clothing, glasses, hat, accessories, shoes/sandals.',
    'DO NOT change the pose style, camera angle, body proportions, character scale, background style, add text, logo, watermark, extra characters, crop the body, crop hands, or crop feet.',
    'If references conflict, keep the miniver-demo-reference form/template first, then preserve the user identity from the main photo.',
    details,
  ].filter(Boolean).join('\n');
}

function findImageValue(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    if (/^https?:\/\//.test(value) || value.startsWith('data:image/')) return value;
    if (/^[A-Za-z0-9+/=]{200,}$/.test(value)) return `data:image/png;base64,${value}`;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageValue(item);
      if (found) return found;
    }
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['url', 'b64_json', 'image', 'data', 'output', 'result']) {
      const found = findImageValue(object[key]);
      if (found) return found;
    }
    for (const item of Object.values(object)) {
      const found = findImageValue(item);
      if (found) return found;
    }
  }
  return null;
}

function parseSseImage(text: string): string | null {
  for (const line of text.split(/\r?\n/).reverse()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const found = findImageValue(JSON.parse(payload));
      if (found) return found;
    } catch {
      const found = findImageValue(payload);
      if (found) return found;
    }
  }
  return findImageValue(text);
}

async function callImageModel(params: { prompt: string; images: ImageInput[]; model: string }) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  if (!baseUrl || !apiKey) throw new Error('IMAGE_API_NOT_CONFIGURED');

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      n: 1,
      size: 'auto',
      quality: 'auto',
      background: 'auto',
      image_detail: 'high',
      output_format: 'png',
      images: params.images.map((image) => image.data),
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  const text = contentType.startsWith('image/') ? '' : await response.text();
  if (!response.ok) throw new Error(`IMAGE_API_HTTP_${response.status}: ${text.slice(0, 300)}`);

  if (contentType.startsWith('image/')) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { previewDataUrl: asDataUrl(buffer, contentType), prompt: params.prompt };
  }

  const image = contentType.includes('json') ? findImageValue(JSON.parse(text)) : parseSseImage(text);
  if (!image) throw new Error('IMAGE_API_NO_IMAGE');
  if (image.startsWith('data:image/')) return { previewDataUrl: image, prompt: params.prompt };
  return { previewUrl: image, prompt: params.prompt };
}

export async function generateCustomModelImage(params: { prompt: string; images: ImageInput[] }) {
  try {
    return await callImageModel({ ...params, model: IMAGE_MODEL });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldFallback = IMAGE_MODEL !== IMAGE_MODEL_FALLBACK && /gpt-image-2|not supported|IMAGE_API_HTTP_400/i.test(message);
    if (!shouldFallback) throw error;
    console.warn('[CustomModelImage] Primary image model failed, retrying fallback:', message.slice(0, 180));
    return callImageModel({ ...params, model: IMAGE_MODEL_FALLBACK });
  }
}

async function imageUrlToBuffer(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`FETCH_IMAGE_${response.status}`);
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'image/png',
  };
}

async function createFileRecord(params: { key: string; orderItemId: string; characterIndex: number; size: number; contentType: string }) {
  const supabase = getAdminSupabase();
  const fileUrl = `/api/files/${params.key}`;
  const now = new Date().toISOString();
  const { data: file, error } = await supabase
    .from('files')
    .insert({
      file_url: fileUrl,
      mime_type: params.contentType,
      size_bytes: params.size,
      provider: 'r2',
      original_filename: `Ảnh mô hình ${params.characterIndex}.png`,
      object_key: params.key,
      created_at: now,
    })
    .select('id')
    .single();
  if (error || !file) throw new Error(error?.message || 'FILE_RECORD_FAILED');

  await supabase.from('file_links').insert({
    file_id: file.id,
    ref_type: 'order_item',
    ref_id: params.orderItemId,
    tag: 'model_image',
    metadata: { character_index: params.characterIndex, original_name: `Ảnh mô hình ${params.characterIndex}.png`, source: 'ai_model_preview' },
    created_at: now,
  });
  return file.id as string;
}

export async function persistPaidCustomModelImages(orderId: string) {
  const supabase = getAdminSupabase();
  const { data: order } = await supabase.from('orders').select('id, order_code, order_type, payment_status').eq('id', orderId).maybeSingle();
  if (!order || order.order_type !== 'custom' || order.payment_status !== 'paid') return { persisted: 0 };

  const { data: items } = await supabase.from('order_items').select('id, configuration').eq('order_id', orderId);
  let persisted = 0;
  for (const item of items || []) {
    const config = (item.configuration || {}) as Record<string, any>;
    const drafts = Array.isArray(config.modelImageDrafts) ? config.modelImageDrafts as CustomModelImageDraft[] : [];
    let changed = false;

    for (const draft of drafts) {
      if (!draft?.approved || draft.generatedModelImage?.url) continue;
      let imageData: { buffer: Buffer; contentType: string } | null = null;
      if (draft.previewUrl) {
        try { imageData = await imageUrlToBuffer(draft.previewUrl); } catch { imageData = null; }
      }
      if (!imageData) {
        const images = [await getDemoReferenceImage()];
        for (const [url, name] of [
          [draft.mainImageUrl, 'main-user-photo'],
          [draft.glassesImageUrl, 'glasses-reference'],
          [draft.hatImageUrl, 'hat-reference'],
        ] as const) {
          const image = await fetchImageAsInput(url, name).catch(() => null);
          if (image) images.push(image);
        }
        const generated = await generateCustomModelImage({ prompt: draft.prompt, images });
        const generatedUrl = generated.previewUrl || generated.previewDataUrl;
        if (!generatedUrl) continue;
        imageData = generatedUrl.startsWith('data:image/')
          ? { buffer: Buffer.from(generatedUrl.split(',')[1] || '', 'base64'), contentType: generatedUrl.slice(5, generatedUrl.indexOf(';')) || 'image/png' }
          : await imageUrlToBuffer(generatedUrl);
      }

      const key = `custom-models/${order.order_code}/model-${draft.characterIndex}-${Date.now()}.png`;
      await uploadToR2(imageData.buffer, key, imageData.contentType, { orderCode: order.order_code, source: 'ai-model-image' });
      const fileId = await createFileRecord({ key, orderItemId: item.id, characterIndex: draft.characterIndex, size: imageData.buffer.length, contentType: imageData.contentType });
      draft.generatedModelImage = { url: `/api/files/${key}`, key, fileId };
      persisted += 1;
      changed = true;
    }

    if (changed) {
      const characters = Array.isArray(config.characters) ? config.characters : [];
      config.characters = characters.map((character: any) => {
        const draft = drafts.find((item) => item.characterIndex === character.index && item.generatedModelImage?.url);
        return draft ? { ...character, generatedModelImage: draft.generatedModelImage } : character;
      });
      config.modelImageDrafts = drafts;
      await supabase.from('order_items').update({ configuration: config }).eq('id', item.id);
    }
  }
  return { persisted };
}
