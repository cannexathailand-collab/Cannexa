export type WebsitePaymentMethod = 'TRANSFER' | 'COD';

export const websiteShippingFees: Record<WebsitePaymentMethod, number> = {
  TRANSFER: 5000,
  COD: 10000,
};

export type WebsitePaymentDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  version: string | null;
  qrImageVersion?: string | null;
};

export function websitePaymentReady(details: WebsitePaymentDetails) {
  const accountNumber = details.accountNumber.normalize('NFKC').replace(/[\s-]/g, '');
  return !!details.bankName.trim() && !!details.accountName.trim() && /^\d{6,30}$/.test(accountNumber);
}
