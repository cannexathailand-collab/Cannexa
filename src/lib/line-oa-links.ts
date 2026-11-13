import {baseUrl} from './config';
export const customerAccountLabel='บัญชีลูกค้า';
export function customerAccountUrl(){return new URL('/customer?tab=profile',baseUrl()).href;}
