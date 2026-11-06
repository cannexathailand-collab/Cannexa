const customerPrefixes='CDEFGHIJKLMNOPQRSTUVWXYZAB';
const codesPerPrefix=9999;
function prefixForBlock(block:number){
 if(block<26)return customerPrefixes[block];
 let value=block+1,prefix='';
 while(value>0){value--;prefix=String.fromCharCode(65+value%26)+prefix;value=Math.floor(value/26);}
 return prefix;
}
function blockForPrefix(prefix:string){
 if(prefix.length===1)return customerPrefixes.indexOf(prefix);
 let value=0;
 for(const char of prefix)value=value*26+char.charCodeAt(0)-64;
 return value-1;
}
export function displayCustomerCode(code:string){
 const match=/^CUS-(\d{8})$/.exec(code);
 if(!match)return code;
 const number=Number(match[1]),block=Math.floor((number-1)/codesPerPrefix);
 if(number>0)return prefixForBlock(block)+String((number-1)%codesPerPrefix+1).padStart(4,'0');
 return 'C'+String(number).padStart(4,'0');
}
export function canonicalCustomerCode(value:string){
 const code=value.trim().toUpperCase(),short=/^([A-Z]{1,3})(\d{4})$/.exec(code);
 if(short&&Number(short[2])>0){
  const number=blockForPrefix(short[1])*codesPerPrefix+Number(short[2]);
  return number<=99999999?'CUS-'+String(number).padStart(8,'0'):code;
 }
 // Continue accepting numeric C aliases already issued by older versions.
 const match=/^C(\d{5,8})$/.exec(code);
 return match&&Number(match[1])>0?'CUS-'+match[1].padStart(8,'0'):code;
}
