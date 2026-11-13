export type CardPreviewResearch={text:string;needsReview:boolean;sourceStatus?:'verified'|'suggested';reviewReason?:string;sources:string[];previewToken?:string;images?:{slot:number;url:string|null}[]};
export type CardPreviewProduct={code:string;name:string|null;description?:string;linkUrl?:string;images:{slot:number;url:string|null}[];keyword:string;missingImageSlots:number[];research?:CardPreviewResearch;researchError?:string;confirmed?:boolean;previewToken?:string};
export function canConfirmPreview(product:CardPreviewProduct){
 return !!product.research?.text.trim()&&!!product.research.sources.length&&!!product.previewToken&&!product.researchError;
}
export function confirmPreview(product:CardPreviewProduct):CardPreviewProduct{
 if(!canConfirmPreview(product))return product;
 return {...product,confirmed:true};
}
export function replacePreviewResearch(product:CardPreviewProduct,research:CardPreviewResearch):CardPreviewProduct{
 const {previewToken,images,...result}=research;
 return {...product,research:result,images:images??product.images,previewToken,researchError:undefined,confirmed:false};
}
export function previewSummary(products:CardPreviewProduct[]){
 const confirmed=products.filter(product=>product.confirmed).length;
 return confirmed===products.length&&products.length?'ยืนยันข้อมูลตัวอย่างแล้ว · '+confirmed+' รายการ':'เตรียมตัวอย่างแล้ว · ยืนยันข้อมูล '+confirmed+'/'+products.length+' รายการ';
}
