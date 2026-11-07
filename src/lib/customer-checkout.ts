import type {CustomerCatalogProduct} from './customer-catalog';
import {cartItemKey, cartQuantityError, type CustomerCartItem} from './customer-cart';

export type CustomerCheckoutItem = CustomerCartItem & {expectedUnitPriceSatang: number};
export type CustomerCheckoutPayload = {
  requestKey: string;
  items: CustomerCheckoutItem[];
  expectedTotalSatang: number;
};
export type CustomerCheckoutOrder = {id: string; orderNumber: string; status: string; totalSatang: number};

const requestKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const definiteFailureCodes = new Set(['PRICE_CHANGED', 'STOCK_CHANGED', 'PRODUCT_UNAVAILABLE', 'TOTAL_CHANGED', 'INVALID_DELIVERY', 'INVALID_WEBSITE_ORDER', 'ORDER_TOO_LARGE']);

export function isDefiniteCheckoutFailure(status: number, code: unknown) {
  return (status === 400 || status === 409) && typeof code === 'string' && definiteFailureCodes.has(code);
}

export function readCustomerCheckout(value: string | null): CustomerCheckoutPayload | null {
  if (!value || value.length > 50000) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed.requestKey !== 'string' || !requestKeyPattern.test(parsed.requestKey) ||
        !Array.isArray(parsed.items) || !parsed.items.length || parsed.items.length > 100) return null;
    const items: CustomerCheckoutItem[] = [];
    const keys = new Set<string>();
    let total = 0;
    for (const raw of parsed.items) {
      if (!raw || typeof raw.code !== 'string' || !raw.code || raw.code.length > 50 ||
          typeof raw.pack !== 'string' || !raw.pack || raw.pack.length > 32 ||
          !Number.isSafeInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 999 ||
          !Number.isSafeInteger(raw.expectedUnitPriceSatang) || raw.expectedUnitPriceSatang <= 0) return null;
      const item = {code: raw.code, pack: raw.pack, quantity: raw.quantity, expectedUnitPriceSatang: raw.expectedUnitPriceSatang};
      const key = cartItemKey(item);
      if (keys.has(key)) return null;
      keys.add(key);
      items.push(item);
      total += item.expectedUnitPriceSatang * item.quantity;
      if (!Number.isSafeInteger(total)) return null;
    }
    if (total !== parsed.expectedTotalSatang) return null;
    return {requestKey: parsed.requestKey, items, expectedTotalSatang: total};
  } catch {
    return null;
  }
}

export function createCustomerCheckout(items: CustomerCartItem[], products: CustomerCatalogProduct[], requestKey: string): CustomerCheckoutPayload {
  if (!items.length || items.length > 100) throw Error('กรุณาเลือกสินค้าในตะกร้าให้ครบก่อนส่งออเดอร์');
  const payloadItems = items.map(item => {
    const product = products.find(candidate => candidate.code === item.code);
    const price = product?.prices.find(candidate => candidate.pack === item.pack);
    if (!product || !price) throw Error('สินค้าในตะกร้าเปลี่ยนแล้ว กรุณาอัปเดตรายการและตรวจสอบอีกครั้ง');
    const problem = cartQuantityError(items, product, price, item.quantity);
    if (problem) throw Error(item.code + ' · ' + problem);
    return {...item, expectedUnitPriceSatang: price.priceSatang};
  });
  const expectedTotalSatang = payloadItems.reduce((total, item) => total + item.expectedUnitPriceSatang * item.quantity, 0);
  const payload = readCustomerCheckout(JSON.stringify({requestKey, items: payloadItems, expectedTotalSatang}));
  if (!payload) throw Error('ข้อมูลตะกร้าไม่ถูกต้อง กรุณาตรวจสอบรายการสินค้าอีกครั้ง');
  return payload;
}

export function checkoutCartItems(payload: CustomerCheckoutPayload): CustomerCartItem[] {
  return payload.items.map(({code, pack, quantity}) => ({code, pack, quantity}));
}

export function readCheckoutOrder(value: unknown): CustomerCheckoutOrder | null {
  if (!value || typeof value !== 'object') return null;
  const order = value as Record<string, unknown>;
  if (typeof order.id !== 'string' || !order.id || typeof order.orderNumber !== 'string' || !order.orderNumber ||
      typeof order.status !== 'string' || !order.status || !Number.isSafeInteger(order.totalSatang) || Number(order.totalSatang) <= 0) return null;
  return {id: order.id, orderNumber: order.orderNumber, status: order.status, totalSatang: Number(order.totalSatang)};
}
