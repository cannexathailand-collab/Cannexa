import {cookies} from 'next/headers';
import {customerLanguageCookie,customerLanguageTools,resolveCustomerLanguage} from './customer-language';
export async function customerLanguage(){return customerLanguageTools(resolveCustomerLanguage((await cookies()).get(customerLanguageCookie)?.value));}
