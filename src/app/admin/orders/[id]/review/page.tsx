import {notFound} from "next/navigation";
import {requireAdminPage} from "@/lib/auth";
import {orderReview} from "@/lib/order-review";
import {OrderReviewView} from "@/app/order-review-view";
export default async function Review({params}:{params:Promise<{id:string}>}){
 await requireAdminPage();const {id}=await params;const data=await orderReview(id,{role:"owner"});if(!data)notFound();
 return <OrderReviewView data={data} backHref="/admin/orders"/>;
}
