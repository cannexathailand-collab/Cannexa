export function salesCommissionRate(seller:{salesCommissionBps:number;salesCommissionTransferBps?:number|null;salesCommissionCodBps?:number|null},payment:string|null){
 return (payment==='COD'?seller.salesCommissionCodBps:payment==='โอน'?seller.salesCommissionTransferBps:undefined)??seller.salesCommissionBps;
}
export function salesCommissionUsesCost(basis:string){return basis==='PROFIT'||basis==='GROSS_PROFIT';}
export function salesCommissionBasisLabel(basis:string){return salesCommissionUsesCost(basis)?'กำไรหลังหักต้นทุนสินค้า':'ยอดขาย';}
export function commissionPercentBps(value:FormDataEntryValue|null){
 if(value===null)return undefined;
 if(typeof value!=='string'||!/^\d{1,3}(?:\.\d{1,2})?$/.test(value.trim()))throw Error('INVALID_COMMISSION_PERCENT');
 const n=Number(value);if(n<0||n>100)throw Error('INVALID_COMMISSION_PERCENT');return Math.round(n*100);
}
