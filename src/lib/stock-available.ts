export const STOCK_AVAILABLE_HEADER='จำนวนสินค้าที่สามารถขายได้ (G)';
export const STOCK_PENDING_HEADER='จำนวนรอจ่าย';
export const STOCK_PRECOUNTED_HEADER='รอจ่ายที่หักไว้ในยอดเดิม (G)';
export const STOCK_UNVERIFIED_HEADER='รอเทียบยอดจ่ายเดิม (G)';
export function stockAvailableQuantity(product:{remainingQuantity:number|null;issuedQuantity?:number|null;completedQuantity?:number|null;precountedPendingQuantity?:number|null;unverifiedPendingQuantity?:number|null}){
 if((product.unverifiedPendingQuantity??0)>0)return null;
 if(product.remainingQuantity===null)return null;
 // Older snapshots already subtract issued stock. Do not subtract it a second time.
 if(product.completedQuantity===undefined)return product.remainingQuantity;
 if(product.issuedQuantity==null)return null;
 return Math.round((product.remainingQuantity-product.issuedQuantity+(product.precountedPendingQuantity??0))*1000)/1000;
}
export const stockAvailableFormula='=IF(OR(INDEX(G:G,ROW())="",N(INDEX(P:P,ROW()))>0),"",INDEX(G:G,ROW())-INDEX(F:F,ROW())+N(INDEX(O:O,ROW())))';
