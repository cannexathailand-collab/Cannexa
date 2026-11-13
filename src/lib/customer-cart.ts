import type {CustomerCatalogPrice, CustomerCatalogProduct} from './customer-catalog';

export type CustomerCartItem = {code: string; pack: string; quantity: number};

export function cartItemKey(item: Pick<CustomerCartItem, 'code' | 'pack'>) {
  return item.code + '|' + item.pack;
}

export function readCustomerCart(value: string | null): CustomerCartItem[] {
  if (!value || value.length > 50000) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const items = new Map<string, CustomerCartItem>();
    for (const raw of parsed.slice(0, 100)) {
      if (!raw || typeof raw.code !== 'string' || !raw.code || raw.code.length > 50 ||
          typeof raw.pack !== 'string' || !raw.pack || raw.pack.length > 32 ||
          !Number.isSafeInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 999) continue;
      const item = {code: raw.code, pack: raw.pack, quantity: raw.quantity};
      const key = cartItemKey(item);
      item.quantity = Math.min(999, item.quantity + (items.get(key)?.quantity ?? 0));
      items.set(key, item);
    }
    return [...items.values()];
  } catch {
    return [];
  }
}

export function cartQuantityError(
  items: CustomerCartItem[], product: CustomerCatalogProduct,
  price: CustomerCatalogPrice, quantity: number,
) {
  if (product.saleEnabled === false) return 'สินค้านี้ไม่พร้อมขาย';
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return 'จำนวนต้องเป็นเลขเต็มตั้งแต่ 1 ถึง 999';
  if (price.priceSatang <= 0) return 'สินค้าขนาดนี้ยังไม่พร้อมแสดงราคา';
  if (!Number.isSafeInteger(price.priceSatang * quantity)) return 'ยอดรวมรายการนี้สูงเกินกว่าที่รองรับ';
  if (product.available === null) return 'กำลังรอข้อมูลสต๊อกของสินค้านี้';
  const otherMilliGrams = items.filter(item => item.code === product.code && item.pack !== price.pack).reduce((sum, item) => {
    const otherPrice = product.prices.find(candidate => candidate.pack === item.pack);
    return sum + (otherPrice ? Math.round(otherPrice.grams * 1000) * item.quantity : 0);
  }, 0);
  const requestedMilliGrams = otherMilliGrams + Math.round(price.grams * 1000) * quantity;
  if (requestedMilliGrams > Math.round(product.available * 1000)) return 'จำนวนในตะกร้าเกินสินค้าที่พร้อมขาย';
  return null;
}
