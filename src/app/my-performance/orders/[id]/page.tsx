import {notFound} from "next/navigation";
import {requireAdminPage} from "@/lib/auth";
import {orderReview} from "@/lib/order-review";
import {OrderReviewView} from "@/app/order-review-view";
export default async function Review({params}:{params:Promise<{id:string}>}){
 const a=await requireAdminPage(["employee"]);const {id}=await params;const data=await orderReview(id,{role:"employee",username:a.username,affiliateId:a.affiliateId});if(!data)notFound();
 return <main className="center-page"><section className="customer" style={{maxWidth:800}}><OrderReviewView data={data} backHref="/my-performance"/></section></main>;
}
