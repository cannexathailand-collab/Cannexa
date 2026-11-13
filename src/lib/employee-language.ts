import {customerLanguageTools,type CustomerLanguage} from './customer-language';
import {employeeEnglish} from './employee-translations';
export function employeeLanguageTools(language:CustomerLanguage){
 const base=customerLanguageTools(language);
 return {...base,t:(value:string|number|null|undefined)=>{const text=String(value??'');if(language==='th')return text;
 if(Object.hasOwn(employeeEnglish,text))return employeeEnglish[text];
 const trimmed=text.trim();
 return Object.hasOwn(employeeEnglish,trimmed)?text.replace(trimmed,employeeEnglish[trimmed]):base.t(text);}};
}
