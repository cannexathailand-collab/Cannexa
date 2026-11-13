import {customerLanguage} from './customer-language-server';
import {employeeLanguageTools} from './employee-language';
export async function employeeLanguage(){return employeeLanguageTools((await customerLanguage()).language);}
