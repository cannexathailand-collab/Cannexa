const normalizedText=(value:string)=>value.normalize('NFKC').replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-3664));
const pattern=/(?<!\d)(?:\+?66(?:[\s().-]*0)?|0)(?:[\s().-]*\d){8,9}(?!\d)/g;
const normalizedNumber=(value:string)=>{const digits=value.replace(/[\s()+.-]/g,'');return digits.startsWith('660')?'0'+digits.slice(3):digits.startsWith('66')?'0'+digits.slice(2):digits;};
export function extractContactPhones(value:string){return [...new Set([...normalizedText(value).matchAll(pattern)].map(m=>normalizedNumber(m[0])))];}
export function stripContactPhones(value:string){return normalizedText(value).replace(pattern,' ');}
export function contactPhones(value:string){
 const text=normalizedText(value),phones=extractContactPhones(text),remaining=stripContactPhones(text).replace(/\bor\b|หรือ/gi,'').replace(/[\s/,;|]+/g,'');
 if(phones.length&&!remaining)return phones;
 return [...new Set(text.split(/\s*(?:\/|,|;|\||\bor\b|หรือ|\r?\n)\s*/i).filter(v=>v.trim()).map(normalizedNumber))];
}
export function validContactPhones(value:string){
 const phones=contactPhones(value);return phones.length>0&&phones.every(phone=>/^0\d{9}$/.test(phone)&&!/^0+$/.test(phone))?phones:null;
}
