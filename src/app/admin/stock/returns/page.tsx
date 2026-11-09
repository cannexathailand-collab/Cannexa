import Link from 'next/link';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {StockReturnStatus} from '@/app/stock-return-status';

export default async function StockReturns({searchParams}:{searchParams:Promise<{returnPage?:string;returnResult?:string}>}){
 const actor=await requireStockPage(stockOperators);
 const params=await searchParams;
 return <>
  <header className="intro"><div><h1>รายการสินค้าตีกลับ</h1><p>ตรวจเลขออเดอร์และสินค้าที่ได้รับก่อนยืนยันรับคืนครบ</p></div><Link className="button secondary" href="/admin/stock/history#return-history">ประวัติรับคืน</Link></header>
  <StockReturnStatus page={params.returnPage} result={params.returnResult} returnPath="/admin/stock/returns" orderBaseHref={actor.role==='store'?'/admin/store-orders/':'/admin/orders/'} orderSuffix={actor.role==='store'?'':'/review'}/>
 </>;
}
