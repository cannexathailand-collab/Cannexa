import {approvers} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {SalesOverview} from "@/app/sales-overview";
import type {SalesFilters} from "@/lib/sales-report";
export default async function Sales({searchParams}:{searchParams:Promise<SalesFilters>}){
 await requireAdminPage(approvers);
 return <><h1>บัญชี · ยอดขาย</h1><SalesOverview filters={await searchParams} action="/admin/sales"/></>;
}
