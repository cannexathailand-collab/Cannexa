export const STOCK_AVAILABLE_HEADER='จำนวนสินค้าที่สามารถขายได้ (G)';
export const STOCK_PENDING_HEADER='จำนวนรอจ่าย';
export function stockAvailableQuantity(product:{remainingQuantity:number|null;issuedQuantity?:number|null;completedQuantity?:number|null}){
 if(product.remainingQuantity===null)return null;
 // Older snapshots already subtract issued stock. Do not subtract it a second time.
 if(product.completedQuantity===undefined)return product.remainingQuantity;
 if(product.issuedQuantity==null)return null;
 return Math.round((product.remainingQuantity-product.issuedQuantity)*1000)/1000;
}
export const stockAvailableFormula='=INDEX(G:G,ROW())-INDEX(F:F,ROW())';
