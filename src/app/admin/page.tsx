import { redirect } from 'next/navigation';

export default function AdminEntryPage() {
    redirect('/api/admin/launch');
}
