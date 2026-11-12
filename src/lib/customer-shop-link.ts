import {stockCode} from './stock-code';

export const shopEntryCookie='customer_shop_entry';
export function customerShopProduct(value:unknown){const parsed=stockCode.safeParse(value);return parsed.success?parsed.data:null;}
export function customerProductPath(value:unknown){const code=customerShopProduct(value);if(!code)throw Error('INVALID_PRODUCT_CODE');return '/customer/shop/'+encodeURIComponent(code);}
