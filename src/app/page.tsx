import {redirect} from "next/navigation";
import {requireAccount} from '@/lib/auth';
import {home} from '@/lib/accounts';
export default async function Home(){const account=await requireAccount();redirect(home(account.role));}
