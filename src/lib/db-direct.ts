import { getMongoDb } from '@/lib/mongodb';

export const dbRequest = {
    async query(_text: string, _params?: unknown[]) {
        const db = await getMongoDb();
        return { rows: [], rowCount: 0, db: db.databaseName };
    },
};
