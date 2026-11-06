export function customerTags(customer:{legacy:boolean;lineUserKey:string|null;conversionId:string|null;referrer:{code:string;name:string}|null},teams:string[]){
 return [...new Set([
  customer.legacy?'ลูกค้าเก่า':'ลูกค้าใหม่',
  ...(customer.lineUserKey||customer.conversionId?['LINE']:[]),
  ...(customer.referrer?['ผู้แนะนำ: '+customer.referrer.name+' · '+customer.referrer.code]:[]),
  ...teams.map(team=>'ทีม: '+team),
 ])];
}
