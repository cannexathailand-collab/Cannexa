import {redirect} from 'next/navigation';
import {requireAdminPage} from '@/lib/auth';
export default async function Store(){await requireAdminPage(['store']);redirect('/admin/stock');}
