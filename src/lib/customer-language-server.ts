import {cookies} from 'next/headers';
import {customerLanguageCookie,customerLanguageTools,readCustomerLanguage} from './customer-language';
export async function customerLanguage(){return customerLanguageTools(readCustomerLanguage((await cookies()).get(customerLanguageCookie)?.value)??'th');}
