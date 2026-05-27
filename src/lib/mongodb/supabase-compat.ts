import { randomUUID } from 'crypto';
import type { Collection, Document, Filter } from 'mongodb';
import { getMongoDb } from './client';

type CountMode = 'exact' | 'planned' | 'estimated';

interface QueryOptions {
    count?: CountMode;
    head?: boolean;
}

interface QueryResult<T = any> {
    data: any;
    error: { code?: string; message: string } | null;
    count?: number | null;
}

type Operation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

const TABLE_ALIASES: Record<string, string> = {
    users: 'profiles',
    user_addresses: 'addresses',
};

const RELATION_FIELDS: Record<string, string> = {
    items: 'order_items',
    order_items: 'order_items',
    product_variants: 'product_variants',
    variants: 'product_variants',
    categories: 'categories',
    category: 'categories',
};

function normalizeTable(table: string): string {
    return TABLE_ALIASES[table] || table;
}

function normalizeField(field: string): string {
    if (field === 'id') return '_id';
    if (field.endsWith('.id')) return field.replace(/\.id$/, '._id');
    return field;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOrExpression(expression: string): Filter<Document>[] {
    return expression
        .split(',')
        .map((clause) => clause.trim())
        .map((clause) => {
            const [field, op, ...rawParts] = clause.split('.');
            const value = rawParts.join('.');
            if (!field || !op || !value) return null;
            const key = normalizeField(field);
            if (op === 'eq') return { [key]: value } as Filter<Document>;
            if (op === 'is' && value === 'null') return { $or: [{ [key]: null }, { [key]: { $exists: false } }] } as Filter<Document>;
            if (op === 'ilike') {
                const pattern = escapeRegExp(value).replace(/%/g, '.*');
                return { [key]: { $regex: `^${pattern}$`, $options: 'i' } } as Filter<Document>;
            }
            return null;
        })
        .filter(Boolean) as Filter<Document>[];
}

function toMongoDocument<T extends Record<string, unknown>>(input: T): Document {
    const doc: Document = { ...input };
    if ('id' in doc) {
        doc._id = doc.id;
        delete doc.id;
    }
    if (!doc._id) doc._id = randomUUID();
    return doc;
}

function fromMongoDocument<T = Document>(input: Document | null): T | null {
    if (!input) return null;
    const { _id, ...rest } = input;
    return { id: String(_id), ...rest } as T;
}

function fromMongoDocuments<T = Document>(input: Document[]): T[] {
    return input.map((doc) => fromMongoDocument<T>(doc)).filter(Boolean) as T[];
}

class MongoSupabaseQuery<T = any> implements PromiseLike<QueryResult<T>> {
    private operation: Operation = 'select';
    private payload: unknown;
    private filters: Filter<Document> = {};
    private sort: Record<string, 1 | -1> = {};
    private skipCount = 0;
    private limitCount: number | null = null;
    private singleMode = false;
    private maybeSingleMode = false;
    private selectedRelations = new Set<string>();
    private countMode: CountMode | undefined;

    constructor(private readonly table: string) { }

    select(columns?: string, options?: QueryOptions): this {
        this.operation = this.operation === 'select' ? 'select' : this.operation;
        this.countMode = options?.count;
        if (columns) {
            for (const [field, collection] of Object.entries(RELATION_FIELDS)) {
                if (columns.includes(field) || columns.includes(collection)) {
                    this.selectedRelations.add(collection);
                }
            }
        }
        return this;
    }

    insert(payload: unknown): this {
        this.operation = 'insert';
        this.payload = payload;
        return this;
    }

    update(payload: unknown): this {
        this.operation = 'update';
        this.payload = payload;
        return this;
    }

    upsert(payload: unknown, _options?: Record<string, unknown>): this {
        this.operation = 'upsert';
        this.payload = payload;
        return this;
    }

    delete(): this {
        this.operation = 'delete';
        return this;
    }

    eq(field: string, value: unknown): this {
        this.filters[normalizeField(field)] = value;
        return this;
    }

    neq(field: string, value: unknown): this {
        this.filters[normalizeField(field)] = { $ne: value };
        return this;
    }

    is(field: string, value: unknown): this {
        const key = normalizeField(field);
        this.filters[key] = value === null
            ? { $in: [null], $exists: false }
            : value;
        if (value === null) {
            delete this.filters[key];
            this.filters.$or = [{ [key]: null }, { [key]: { $exists: false } }] as any;
        }
        return this;
    }

    gt(field: string, value: unknown): this {
        this.mergeOperator(field, '$gt', value);
        return this;
    }

    gte(field: string, value: unknown): this {
        this.mergeOperator(field, '$gte', value);
        return this;
    }

    lt(field: string, value: unknown): this {
        this.mergeOperator(field, '$lt', value);
        return this;
    }

    lte(field: string, value: unknown): this {
        this.mergeOperator(field, '$lte', value);
        return this;
    }

    in(field: string, values: unknown[]): this {
        this.filters[normalizeField(field)] = { $in: values };
        return this;
    }

    or(expression: string): this {
        const clauses = parseOrExpression(expression);
        if (clauses.length > 0) {
            const currentOr = Array.isArray((this.filters as any).$or) ? (this.filters as any).$or : [];
            (this.filters as any).$or = [...currentOr, ...clauses];
        }
        return this;
    }

    order(field: string, options?: { ascending?: boolean }): this {
        this.sort[normalizeField(field)] = options?.ascending === false ? -1 : 1;
        return this;
    }

    range(from: number, to: number): this {
        this.skipCount = from;
        this.limitCount = Math.max(to - from + 1, 0);
        return this;
    }

    limit(count: number): this {
        this.limitCount = count;
        return this;
    }

    single(): this {
        this.singleMode = true;
        this.limitCount = 1;
        return this;
    }

    maybeSingle(): this {
        this.maybeSingleMode = true;
        this.limitCount = 1;
        return this;
    }

    then<TResult1 = QueryResult<T>, TResult2 = never>(
        onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.execute().then(onfulfilled, onrejected);
    }

    private mergeOperator(field: string, operator: string, value: unknown): void {
        const key = normalizeField(field);
        const existing = this.filters[key];
        this.filters[key] = typeof existing === 'object' && existing !== null && !Array.isArray(existing)
            ? { ...existing, [operator]: value }
            : { [operator]: value };
    }

    private async collection(): Promise<Collection<Document>> {
        const db = await getMongoDb();
        return db.collection(normalizeTable(this.table));
    }

    private async execute(): Promise<QueryResult<T>> {
        try {
            if (this.operation === 'insert') return await this.executeInsert();
            if (this.operation === 'update') return await this.executeUpdate();
            if (this.operation === 'delete') return await this.executeDelete();
            if (this.operation === 'upsert') return await this.executeUpsert();
            return await this.executeSelect();
        } catch (error) {
            return {
                data: null,
                error: { message: error instanceof Error ? error.message : String(error) },
                count: null,
            };
        }
    }

    private async executeSelect(): Promise<QueryResult<T>> {
        const collection = await this.collection();
        let cursor = collection.find(this.filters);
        if (Object.keys(this.sort).length > 0) cursor = cursor.sort(this.sort);
        if (this.skipCount > 0) cursor = cursor.skip(this.skipCount);
        if (this.limitCount !== null) cursor = cursor.limit(this.limitCount);

        const [docs, count] = await Promise.all([
            cursor.toArray(),
            this.countMode ? collection.countDocuments(this.filters) : Promise.resolve(null),
        ]);
        const hydrated = await this.hydrateRelations(docs);

        if (this.singleMode || this.maybeSingleMode) {
            if (hydrated.length === 0) {
                return this.maybeSingleMode
                    ? { data: null, error: null, count }
                    : { data: null, error: { code: 'PGRST116', message: 'No rows found' }, count };
            }
            return { data: fromMongoDocument<T>(hydrated[0]), error: null, count };
        }

        return { data: fromMongoDocuments<T>(hydrated), error: null, count };
    }

    private async executeInsert(): Promise<QueryResult<T>> {
        const collection = await this.collection();
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const docs = rows.map((row) => toMongoDocument(row as Record<string, unknown>));
        if (docs.length > 0) await collection.insertMany(docs, { ordered: false });
        const data = this.singleMode ? fromMongoDocument<T>(docs[0]) : fromMongoDocuments<T>(docs);
        return { data, error: null, count: docs.length };
    }

    private async executeUpdate(): Promise<QueryResult<T>> {
        const collection = await this.collection();
        const updateDoc = { ...(this.payload as Record<string, unknown>) };
        delete updateDoc.id;
        delete updateDoc._id;
        const result = await collection.updateMany(this.filters, { $set: updateDoc });
        if (result.matchedCount === 0) {
            return this.maybeSingleMode
                ? { data: null, error: null, count: 0 }
                : { data: null, error: { code: 'PGRST116', message: 'No rows found' }, count: 0 };
        }
        const docs = await collection.find(this.filters).limit(this.singleMode || this.maybeSingleMode ? 1 : 0).toArray();
        const data = this.singleMode || this.maybeSingleMode ? fromMongoDocument<T>(docs[0] || null) : fromMongoDocuments<T>(docs);
        return { data, error: null, count: result.matchedCount };
    }

    private async executeUpsert(): Promise<QueryResult<T>> {
        const collection = await this.collection();
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const docs: Document[] = [];
        for (const row of rows) {
            const doc = toMongoDocument(row as Record<string, unknown>);
            await collection.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
            docs.push(doc);
        }
        const data = this.singleMode ? fromMongoDocument<T>(docs[0]) : fromMongoDocuments<T>(docs);
        return { data, error: null, count: docs.length };
    }

    private async executeDelete(): Promise<QueryResult<T>> {
        const collection = await this.collection();
        const docs = await collection.find(this.filters).toArray();
        await collection.deleteMany(this.filters);
        const data = this.singleMode ? fromMongoDocument<T>(docs[0] || null) : fromMongoDocuments<T>(docs);
        return { data, error: null, count: docs.length };
    }

    private async hydrateRelations(docs: Document[]): Promise<Document[]> {
        if (docs.length === 0 || this.selectedRelations.size === 0) return docs;

        const db = await getMongoDb();
        const hydrated = docs.map((doc) => ({ ...doc }));

        if (this.selectedRelations.has('order_items')) {
            const orderIds = hydrated.map((doc) => String(doc._id));
            const items = await db.collection('order_items').find({ order_id: { $in: orderIds } }).toArray();
            for (const doc of hydrated) {
                doc.items = fromMongoDocuments(items.filter((item) => item.order_id === String(doc._id)));
                doc.order_items = doc.items;
            }
        }

        if (this.selectedRelations.has('product_variants')) {
            const productIds = hydrated.map((doc) => String(doc._id));
            const variants = await db.collection('product_variants')
                .find({ product_id: { $in: productIds }, deleted_at: { $exists: false } })
                .sort({ sort_order: 1, created_at: 1 })
                .toArray();
            for (const doc of hydrated) {
                doc.product_variants = fromMongoDocuments(variants.filter((variant) => variant.product_id === String(doc._id)));
                doc.variants = doc.product_variants;
            }
        }

        if (this.selectedRelations.has('categories')) {
            const categoryIds = hydrated
                .map((doc) => doc.category_id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0);
            const categories = categoryIds.length > 0
                ? await db.collection('categories').find({ _id: { $in: categoryIds } } as any).toArray()
                : [];
            for (const doc of hydrated) {
                const category = categories.find((item) => String(item._id) === String(doc.category_id));
                doc.category = category ? fromMongoDocument(category) : null;
            }
        }

        return hydrated;
    }
}

export class MongoSupabaseCompatClient {
    readonly auth = {
        admin: {
            updateUserById: async (..._args: unknown[]) => ({ data: null, error: null }),
            deleteUser: async (..._args: unknown[]) => ({ data: null, error: null }),
        },
        getUser: async (..._args: unknown[]) => ({ data: { user: null }, error: null }),
        getSession: async (..._args: unknown[]) => ({ data: { session: null }, error: null }),
    };
    from<T = any>(table: string): MongoSupabaseQuery<T> {
        return new MongoSupabaseQuery<T>(table);
    }

    async rpc(functionName: string, params: Record<string, unknown> = {}): Promise<QueryResult> {
        try {
            const db = await getMongoDb();
            const now = new Date().toISOString();
            const qty = Math.max(0, Number(params.p_qty || params.qty || 0));
            const variantId = String(params.p_variant_id || params.variant_id || '');
            const productId = String(params.p_product_id || params.product_id || '');

            const syncProductStock = async (id: string) => {
                if (!id) return;
                const variants = await db.collection('product_variants').find({ product_id: id, deleted_at: { $exists: false } }).toArray();
                const stock = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
                await db.collection('products').updateOne({ _id: id } as any, { $set: { stock, updated_at: now } });
            };

            const updateLegacySizeStock = async (id: string, delta: number) => {
                if (!id || delta === 0) return;
                await db.collection('products').updateOne(
                    { 'sizes.id': id },
                    { $inc: { 'sizes.$.stock': delta }, $set: { updated_at: now } },
                );
            };

            const getVariant = async (id: string) => db.collection('product_variants').findOne({ _id: id } as any);

            if (functionName === 'reserve_variant_stock') {
                if (!variantId || qty <= 0) return { data: null, error: { message: 'variant_id and qty are required' } };
                const result = await db.collection('product_variants').updateOne(
                    ({
                        _id: variantId,
                        is_active: { $ne: false },
                        deleted_at: { $exists: false },
                        $expr: { $gte: [{ $subtract: [{ $ifNull: ['$stock', 0] }, { $ifNull: ['$reserved_stock', 0] }] }, qty] },
                    } as any),
                    { $inc: { reserved_stock: qty }, $set: { updated_at: now } },
                );
                if (result.matchedCount === 0) return { data: null, error: { message: 'Insufficient stock or variant not found' } };
                return { data: null, error: null };
            }

            if (functionName === 'confirm_variant_stock' || functionName === 'deduct_variant_stock_direct') {
                if (!variantId || qty <= 0) return { data: null, error: { message: 'variant_id and qty are required' } };
                let result = await db.collection('product_variants').updateOne(
                    { _id: variantId, reserved_stock: { $gte: qty }, stock: { $gte: qty }, deleted_at: { $exists: false } } as any,
                    { $inc: { stock: -qty, reserved_stock: -qty }, $set: { updated_at: now } },
                );
                if (result.matchedCount === 0) {
                    result = await db.collection('product_variants').updateOne(
                        { _id: variantId, stock: { $gte: qty }, deleted_at: { $exists: false } } as any,
                        { $inc: { stock: -qty }, $set: { reserved_stock: 0, updated_at: now } },
                    );
                }
                if (result.matchedCount === 0) return { data: null, error: { message: 'Insufficient stock or variant not found' } };
                const variant = await getVariant(variantId);
                await syncProductStock(String(variant?.product_id || ''));
                await updateLegacySizeStock(variantId, -qty);
                return { data: null, error: null };
            }

            if (functionName === 'release_variant_stock') {
                if (!variantId || qty <= 0) return { data: null, error: { message: 'variant_id and qty are required' } };
                const result = await db.collection('product_variants').updateOne(
                    { _id: variantId, reserved_stock: { $gte: qty }, deleted_at: { $exists: false } } as any,
                    { $inc: { reserved_stock: -qty }, $set: { updated_at: now } },
                );
                if (result.matchedCount === 0) return { data: null, error: { message: 'Reserved stock not found' } };
                return { data: null, error: null };
            }

            if (functionName === 'restore_variant_stock') {
                if (!variantId || qty <= 0) return { data: null, error: { message: 'variant_id and qty are required' } };
                await db.collection('product_variants').updateOne(
                    { _id: variantId, deleted_at: { $exists: false } } as any,
                    { $inc: { stock: qty }, $set: { updated_at: now } },
                );
                const variant = await getVariant(variantId);
                await syncProductStock(String(variant?.product_id || ''));
                await updateLegacySizeStock(variantId, qty);
                return { data: null, error: null };
            }

            if (functionName === 'increment_sold_count') {
                if (!productId || qty <= 0) return { data: null, error: { message: 'product_id and qty are required' } };
                await db.collection('products').updateOne(
                    { _id: productId } as any,
                    { $inc: { sold_count: qty }, $set: { updated_at: now } },
                );
                return { data: null, error: null };
            }

            return { data: null, error: null };
        } catch (error) {
            return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
        }
    }
}

let compatClient: MongoSupabaseCompatClient | null = null;

export function getMongoSupabaseCompatClient(): MongoSupabaseCompatClient {
    compatClient ??= new MongoSupabaseCompatClient();
    return compatClient;
}




