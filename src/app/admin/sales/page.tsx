import {redirect} from 'next/navigation';
import {approvers} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {SalesOverview} from "@/app/sales-overview";
import type {SalesFilters} from "@/lib/sales-report";
import {bangkokDay} from '@/lib/sales-dates';
export default async function Sales({searchParams}:{searchParams:Promise<SalesFilters>}){
 await requireAdminPage(approvers);
 const filters=await searchParams,today=bangkokDay(new Date());
 const selected=filters.from||filters.to||filters.month?filters:{...filters,from:today,to:today};
 if(filters.detail==='INCOME'){const query=new URLSearchParams();for(const [key,value] of Object.entries(selected))if(value&&key!=='detail')query.set(key,value);redirect('/admin/income?'+query.toString());}
 return <SalesOverview filters={selected} action="/admin/sales"/>;
}
