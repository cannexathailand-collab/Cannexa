import {requireAdminPage} from '@/lib/auth';
import {db} from '@/lib/db';
import {readStockSheet} from '@/lib/stock-google';
import {ManualOrderForm} from './order-form';

export default async function CreateOrder(){
 await requireAdminPage();
 const [groups,sellers,customers,stock]=await Promise.all([
  db.orderGroup.findMany({where:{enabled:true,purpose:'ORDER'},select:{id:true,name:true},orderBy:{name:'asc'}}),
  db.userAccount.findMany({where:{role:'employee',active:true,affiliate:{active:true,archivedAt:null}},select:{username:true},orderBy:{username:'asc'}}),
  db.customer.findMany({select:{code:true,name:true,phone:true,address:true},orderBy:{createdAt:'desc'},take:500}),
  readStockSheet().then(result=>result.products.map(product=>({code:product.code,name:product.name}))).catch(()=>[]),
 ]);
 return <><h1>สร้างออเดอร์</h1><p>กรอกออเดอร์เข้าระบบโดยตรง ระบบตรวจข้อมูลและสต๊อกก่อนบันทึก</p><ManualOrderForm groups={groups} sellers={sellers} customers={customers} products={stock}/></>;
}
