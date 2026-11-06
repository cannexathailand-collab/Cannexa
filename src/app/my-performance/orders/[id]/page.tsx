import {notFound} from "next/navigation";
import {requireAdminPage} from "@/lib/auth";
import {orderReview} from "@/lib/order-review";
import {OrderReviewView} from "@/app/order-review-view";
import {EmployeeNav} from '../../employee-nav';
export default async function Review({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string}>}){
 const a=await requireAdminPage(["employee"]);const {id}=await params;const data=await orderReview(id,{role:"employee",username:a.username,affiliateId:a.affiliateId});if(!data)notFound();
 const fromTasks=(await searchParams).from==='tasks';
 return <main className="center-page"><section className="customer" style={{maxWidth:800}}><EmployeeNav active={fromTasks?'tasks':'orders'}/><OrderReviewView data={data} backHref={fromTasks?'/my-performance/tasks':'/my-performance/orders'} backLabel={fromTasks?'กลับงานค้าง':'กลับรายการออเดอร์'}/></section></main>;
}
