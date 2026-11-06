import {db} from './db';
import {defaultOrderTemplate,draftFields,renderOrderDraft} from './order-draft';
import {parseOrderText} from './order-parser';
import {quotedTotal} from './shipment-matching';
export async function orderTemplates(){
 const rows=await db.orderMessageTemplate.findMany({where:{active:true},orderBy:{createdAt:'asc'},select:{id:true,name:true,body:true}});
 return [{id:'standard',name:'แบบมาตรฐาน',body:defaultOrderTemplate},...rows];
}
export function orderTemplateIssues(body:string){
 const issues:string[]=[];
 for(const label of Object.values(draftFields))if(!body.includes('{{'+label+'}}'))issues.push('ต้องมีช่อง {{'+label+'}}');
 const unknown=[...body.matchAll(/\{\{([^{}]+)\}\}/g)].filter(m=>!Object.values(draftFields).includes(m[1] as typeof draftFields[keyof typeof draftFields]));if(unknown.length)issues.push('มีชื่อช่องที่ไม่รองรับ');
 const sample=renderOrderDraft(body,{seller:'seller',recipient:'Sample',phone:'0812345678',address:'Bangkok',products:'CG13 20g',payment:'COD',amount:'1260',customerCode:'C0001'});
 const parsed=parseOrderText(sample);
 if(!parsed||parsed.issues.length||quotedTotal(sample)!==126000)issues.push('คงหัวข้อข้อมูลตามแบบมาตรฐาน และให้รหัสผู้ขายอยู่บรรทัดแรก');
 if(!sample.trim().split('\n').at(-1)?.startsWith('รหัสลูกค้า:'))issues.push('ให้รหัสลูกค้าอยู่บรรทัดสุดท้าย');
 return issues;
}
