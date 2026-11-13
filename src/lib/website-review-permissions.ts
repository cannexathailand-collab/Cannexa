import {websiteOrderReviewers} from './accounts';
export type WebsiteReviewer={role:string;username:string;affiliateId?:string|null};
export function canReviewWebsiteOrders(account:WebsiteReviewer){
 return websiteOrderReviewers.some(role=>role===account.role);
}
// Employee commission identity comes from the authenticated account, never a form field.
export function websiteReviewRequest(account:WebsiteReviewer,value:unknown){
 if(!canReviewWebsiteOrders(account))throw Error('WEBSITE_REVIEW_FORBIDDEN');
 if(account.role!=='employee'||!value||typeof value!=='object'||Array.isArray(value))return value;
 const input=value as Record<string,unknown>;
 if(input.status!=='APPROVED')return input;
 if(!account.affiliateId)throw Error('EMPLOYEE_AFFILIATE_REQUIRED');
 return {...input,sellerCode:account.username};
}
