import {z} from 'zod';

export function validThaiTaxId(value:string){
 if(!/^\d{13}$/.test(value))return false;
 const sum=[...value.slice(0,12)].reduce((total,digit,index)=>total+Number(digit)*(13-index),0);
 return (11-sum%11)%10===Number(value[12]);
}

export const taxInvoiceLineSchema=z.object({
 description:z.string().trim().min(1).max(300),
 quantity:z.string().trim().min(1).max(40),
 grossSatang:z.number().int().nonnegative().max(2147483647),
 treatment:z.enum(['STANDARD','ZERO','EXEMPT']),
});
export type TaxInvoiceLine=z.infer<typeof taxInvoiceLineSchema>;

export function inclusiveTaxTotals(lines:TaxInvoiceLine[],rateBps:number){
 if(!Number.isSafeInteger(rateBps)||rateBps<0||rateBps>10000)throw Error('INVALID_TAX_RATE');
 const rows=lines.map(line=>{
  taxInvoiceLineSchema.parse(line);
  const rate=line.treatment==='STANDARD'?rateBps:0;
  const denominator=BigInt(10000+rate);
  const numerator=BigInt(line.grossSatang)*BigInt(rate);
  const vatSatang=Number((numerator+denominator/2n)/denominator);
  return {...line,netSatang:line.grossSatang-vatSatang,vatSatang};
 });
 const totalSatang=rows.reduce((sum,line)=>sum+line.grossSatang,0);
 if(!Number.isSafeInteger(totalSatang)||totalSatang>2147483647)throw Error('INVALID_TAX_TOTAL');
 const vatSatang=rows.reduce((sum,line)=>sum+line.vatSatang,0);
 return {lines:rows,totalSatang,vatSatang,netSatang:totalSatang-vatSatang};
}

export const taxBuyerSchema=z.object({
 name:z.string().trim().min(1).max(200),address:z.string().trim().min(1).max(2000),
 vatRegistered:z.boolean(),taxId:z.string().trim().max(13),branchCode:z.string().regex(/^\d{5}$/),
}).refine(buyer=>(!buyer.taxId||validThaiTaxId(buyer.taxId))&&(!buyer.vatRegistered||!!buyer.taxId),'กรุณาระบุเลขประจำตัวผู้เสียภาษีของผู้ซื้อให้ถูกต้อง');
