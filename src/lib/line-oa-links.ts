import {baseUrl} from './config';
export const customerAccountLabel='บัญชีลูกค้า';
export function customerAccountUrl(){return new URL('/customer?tab=profile',baseUrl()).href;}
export function cardActionLink(product:{linkUrl?:string}){
 const value=product.linkUrl?.trim();
 if(!value)return {label:customerAccountLabel,url:customerAccountUrl()};
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password)throw Error('OA_LINK_INVALID');
 return {label:'เปิดลิงก์',url:value};
}
