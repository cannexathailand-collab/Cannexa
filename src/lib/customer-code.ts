export function displayCustomerCode(code:string){
 const match=/^CUS-(\d{8})$/.exec(code);
 return match?'C'+String(Number(match[1])).padStart(4,'0'):code;
}
export function canonicalCustomerCode(value:string){
 const code=value.trim().toUpperCase(),match=/^C(\d{4,8})$/.exec(code);
 return match&&Number(match[1])>0?'CUS-'+match[1].padStart(8,'0'):code;
}
