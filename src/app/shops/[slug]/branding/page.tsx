import {withShopWorkspace} from '@/lib/shop-workspace';
import {db} from '@/lib/db';
import {shopPath} from '@/lib/shop-session';
import {DocumentBrandingForm} from '@/app/document-branding-form';
import {ShopWorkspaceNav} from '../workspace-nav';

export default async function Branding({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const content=await withShopWorkspace(slug,async({readOnly})=>{
  const brand=await db.storeBranding.findUnique({where:{id:'active'}});
  const base=shopPath(slug)+'/branding';
  return <section className="card"><h1>ตั้งค่าแบรนด์หลักของร้าน</h1>
   <p>ชื่อ โลโก้ และสีใช้ร่วมกันทั้งระบบของร้านนี้ รวมถึงหน้าล็อกอินและเอกสารใหม่</p>
   {readOnly?<p>โหมดดูข้อมูล</p>:<DocumentBrandingForm initial={brand} endpoint={base+'/settings'} logoBase={base+'/logo/'}/>}
  </section>;
 });
 return <main className="main"><ShopWorkspaceNav slug={slug}/>{content}</main>;
}
