import { getAdminSupabase } from '@/lib/supabase/admin';
import { downloadFromR2, deleteFromR2, existsInR2, isR2Configured } from '@/lib/storage/r2';
import { uploadToPath, isDriveConnected, getDirectUrl, findDriveFileByPath } from '@/lib/google-drive-oauth';

function inferContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'stl') return 'application/sla';
    if (ext === 'obj') return 'text/plain';
    return 'application/octet-stream';
}

export async function archiveOrderFilesToDrive(orderId: string) {
    const result = {
        success: true,
        archived: 0,
        total: 0,
        errors: [] as string[],
        alreadyArchived: false,
        missingOnDrive: [] as string[],
    };

    const driveConnected = await isDriveConnected();
    if (!driveConnected) {
        return { ...result, success: false, errors: ['Google Drive not connected'] };
    }

    const supabase = getAdminSupabase();

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, archived_at, status')
        .eq('id', orderId)
        .single();

    if (orderError || !order) {
        return { ...result, success: false, errors: ['Order not found'] };
    }

    if (order.archived_at) {
        return { ...result, success: true, alreadyArchived: true };
    }

    if (!['completed', 'delivered'].includes(order.status)) {
        return { ...result, success: false, errors: ['Order not completed or delivered'] };
    }

    type OrderFileRow = {
        id: string;
        file_key: string | null;
        file_name: string | null;
        storage_provider: string | null;
        drive_file_id?: string | null;
    };

    const { data: fileRows, error: filesError } = await supabase
        .from('order_files')
        .select('id, file_key, file_name, storage_provider, drive_file_id')
        .or(`order_id.eq.${orderId},order_code.eq.${order.order_code}`);

    if (filesError) {
        return { ...result, success: false, errors: [filesError.message] };
    }

    const files = (fileRows || []).filter((file) => file.file_key) as OrderFileRow[];
    if (files.length === 0) {
        return { ...result, success: false, errors: ['No files found for order'] };
    }
    result.total = files.length;

    const isDriveFile = (file: OrderFileRow) =>
        (file.storage_provider || '') === 'drive' || !!file.drive_file_id;
    const driveFiles = files.filter(isDriveFile);
    let verifiedCount = driveFiles.length;
    const r2Files = files.filter((f) => !isDriveFile(f) && (f.storage_provider || 'r2') === 'r2' && f.file_key);
    const r2Enabled = isR2Configured();

    if (r2Files.length === 0) {
        const pendingFiles = files.filter((file) => !isDriveFile(file));
        const missing: string[] = [];

        for (const file of pendingFiles) {
            if (!file.file_key) continue;
            const key = file.file_key;
            const segments = key.split('/');
            const fileName = file.file_name || segments[segments.length - 1];
            const pathSegments = segments.slice(0, -1);

            const driveFile = await findDriveFileByPath(pathSegments, fileName);
            if (!driveFile) {
                missing.push(fileName);
                continue;
            }

            const driveUrl = getDirectUrl(driveFile.id);
            await supabase
                .from('order_files')
                .update({
                    storage_provider: 'drive',
                    drive_file_id: driveFile.id,
                    drive_url: driveUrl,
                    archived_at: new Date().toISOString(),
                })
                .eq('id', file.id);
            verifiedCount += 1;
        }

        if (missing.length > 0) {
            return {
                ...result,
                success: false,
                errors: ['Missing files on Drive'],
                missingOnDrive: missing,
            };
        }

        if (verifiedCount === result.total) {
            await supabase
                .from('orders')
                .update({ archived_at: new Date().toISOString() })
                .eq('id', orderId);
        }

        return {
            ...result,
            success: verifiedCount === result.total,
            alreadyArchived: verifiedCount === result.total,
        };
    }

    for (const file of r2Files) {
        const fileKey = file.file_key as string;
        const pathSegments = fileKey.split('/');
        const fileName = file.file_name || pathSegments[pathSegments.length - 1];
        const folderSegments = pathSegments.slice(0, -1);

        try {
            if (!r2Enabled) {
                const driveFile = await findDriveFileByPath(folderSegments, fileName);
                if (!driveFile) {
                    result.missingOnDrive.push(fileName);
                    continue;
                }

                const driveUrl = getDirectUrl(driveFile.id);
                await supabase
                    .from('order_files')
                    .update({
                        storage_provider: 'drive',
                        drive_file_id: driveFile.id,
                        drive_url: driveUrl,
                        archived_at: new Date().toISOString(),
                    })
                    .eq('id', file.id);
                verifiedCount += 1;
                continue;
            }

            const exists = await existsInR2(fileKey);
            if (!exists) {
                const driveFile = await findDriveFileByPath(folderSegments, fileName);
                if (!driveFile) {
                    result.missingOnDrive.push(fileName);
                    continue;
                }

                const driveUrl = getDirectUrl(driveFile.id);
                await supabase
                    .from('order_files')
                    .update({
                        storage_provider: 'drive',
                        drive_file_id: driveFile.id,
                        drive_url: driveUrl,
                        archived_at: new Date().toISOString(),
                    })
                    .eq('id', file.id);
                verifiedCount += 1;
                continue;
            }

            const buffer = await downloadFromR2(fileKey);
            const contentType = inferContentType(fileName);

            const driveResult = await uploadToPath(buffer, fileName, contentType, folderSegments);
            const driveUrl = getDirectUrl(driveResult.fileId);

            await supabase
                .from('order_files')
                .update({
                    storage_provider: 'drive',
                    drive_file_id: driveResult.fileId,
                    drive_url: driveUrl,
                    archived_at: new Date().toISOString(),
                })
                .eq('id', file.id);

            await deleteFromR2(fileKey);
            result.archived += 1;
            verifiedCount += 1;
        } catch (error) {
            const msg = `Failed to archive ${fileName}: ${(error as Error).message}`;
            result.errors.push(msg);
        }
    }

    if (result.missingOnDrive.length > 0) {
        return {
            ...result,
            success: false,
            errors: ['Missing files on Drive'],
        };
    }

    if (result.errors.length > 0) {
        return { ...result, success: false };
    }

    if (verifiedCount === result.total) {
        await supabase
            .from('orders')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', orderId);
    }

    return {
        ...result,
        success: verifiedCount === result.total,
        alreadyArchived: result.archived === 0 && verifiedCount === result.total,
    };
}
