import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

interface ContentPageSeed {
    slug: string;
    title?: string | null;
    meta?: Record<string, unknown>;
    is_active?: boolean;
}

interface ContentBlockSeed {
    page_slug: string;
    block_key: string;
    block_type: string;
    sort_order?: number;
    data?: Record<string, unknown>;
    is_active?: boolean;
}

interface ContentSeedFile {
    pages: ContentPageSeed[];
    blocks: ContentBlockSeed[];
}

interface UiLabelSeed {
    scope: string;
    key: string;
    value: unknown;
    description?: string | null;
    is_active?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const envPath = resolve(rootDir, '.env.local');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Loaded .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

function readJson<T>(filePath: string): T {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
}

async function upsertPages(pages: ContentPageSeed[]) {
    const pageIdBySlug = new Map<string, string>();

    for (const page of pages) {
        const payload = {
            slug: page.slug,
            title: page.title ?? null,
            meta: page.meta ?? {},
            is_active: page.is_active ?? true,
        };

        const { data, error } = await supabase
            .from('content_pages')
            .upsert(payload, { onConflict: 'slug' })
            .select('id, slug')
            .single();

        if (error) {
            throw error;
        }

        pageIdBySlug.set(data.slug, data.id);
    }

    return pageIdBySlug;
}

async function upsertBlocks(blocks: ContentBlockSeed[], pageIdBySlug: Map<string, string>) {
    for (const block of blocks) {
        const pageId = pageIdBySlug.get(block.page_slug);
        if (!pageId) {
            throw new Error(`Missing page for slug: ${block.page_slug}`);
        }

        const payload = {
            page_id: pageId,
            block_key: block.block_key,
            block_type: block.block_type,
            sort_order: block.sort_order ?? 0,
            data: block.data ?? {},
            is_active: block.is_active ?? true,
        };

        const { data: existing, error: existingError } = await supabase
            .from('content_blocks')
            .select('id')
            .eq('page_id', pageId)
            .eq('block_key', block.block_key)
            .maybeSingle();

        if (existingError) {
            throw existingError;
        }

        if (existing?.id) {
            const { error } = await supabase
                .from('content_blocks')
                .update({
                    ...payload,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);

            if (error) {
                throw error;
            }
        } else {
            const { error } = await supabase
                .from('content_blocks')
                .insert(payload);

            if (error) {
                throw error;
            }
        }
    }
}

async function upsertLabels(labels: UiLabelSeed[]) {
    if (labels.length === 0) return;

    const payload = labels.map((label) => ({
        scope: label.scope,
        key: label.key,
        value: label.value,
        description: label.description ?? null,
        is_active: label.is_active ?? true,
        updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
        .from('ui_labels')
        .upsert(payload, { onConflict: 'scope,key' });

    if (error) {
        throw error;
    }
}

async function main() {
    const contentPath = resolve(rootDir, 'content/seed/content-pages.json');
    const labelsPath = resolve(rootDir, 'content/seed/ui-labels.json');

    if (!fs.existsSync(contentPath)) {
        throw new Error(`Missing content seed file: ${contentPath}`);
    }

    if (!fs.existsSync(labelsPath)) {
        throw new Error(`Missing ui labels seed file: ${labelsPath}`);
    }

    const contentSeed = readJson<ContentSeedFile>(contentPath);
    const labelSeed = readJson<UiLabelSeed[]>(labelsPath);

    console.log(`Seeding ${contentSeed.pages.length} pages, ${contentSeed.blocks.length} blocks...`);
    const pageMap = await upsertPages(contentSeed.pages);
    await upsertBlocks(contentSeed.blocks, pageMap);

    console.log(`Seeding ${labelSeed.length} ui labels...`);
    await upsertLabels(labelSeed);

    console.log('? Seed complete');
}

main().catch((err) => {
    console.error('? Seed failed:', err);
    process.exit(1);
});
