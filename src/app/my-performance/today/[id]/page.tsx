import {redirect} from 'next/navigation';
export default async function LegacyOrder({params}:{params:Promise<{id:string}>}){
 redirect('/my-performance/orders/'+encodeURIComponent((await params).id));
}
