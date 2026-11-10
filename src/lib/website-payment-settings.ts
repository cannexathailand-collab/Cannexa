import {randomUUID} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db, transaction, userLock} from './db';
import {websitePaymentReady, type WebsitePaymentDetails} from './website-payment';
import {parseRewardImage} from './crm-reward-image';

const text = (max: number) => z.string().transform(value => value.normalize('NFKC').trim().replace(/\s+/g, ' ')).pipe(z.string().max(max));
const settingsInput = z.object({
  bankName: text(100),
  accountName: text(200),
  accountNumber: z.string().max(100).transform(value => value.normalize('NFKC').replace(/[\s-]/g, '')),
  expectedVersion: z.uuid().nullable(),
  qrImage: z.string().max(2800000).nullable().optional(),
}).refine(input => {
  if (!input.bankName && !input.accountName && !input.accountNumber) return true;
  return !!input.bankName && !!input.accountName && /^\d{6,30}$/.test(input.accountNumber);
});

const fields = {bankName: true, accountName: true, accountNumber: true, version: true, qrImageVersion:true} as const;
const emptyDetails: WebsitePaymentDetails = {bankName: '', accountName: '', accountNumber: '', version: null};

export async function loadWebsitePaymentSettings(client: Prisma.TransactionClient = db): Promise<WebsitePaymentDetails> {
  return await client.websitePaymentSettings.findUnique({where: {id: 'active'}, select: fields}) ?? {...emptyDetails};
}

export async function saveWebsitePaymentSettings(actor: string, value: unknown): Promise<WebsitePaymentDetails> {
  const parsed = settingsInput.safeParse(value);
  if (!parsed.success) throw Error('INVALID_WEBSITE_PAYMENT_SETTINGS');
  const {expectedVersion, qrImage, ...details} = parsed.data;
  const image = typeof qrImage==='string'?parseRewardImage(qrImage):null;
  return transaction(async tx => {
    await userLock(tx, 'website-payment-settings:active');
    const previous = await loadWebsitePaymentSettings(tx);
    const accountChanged=previous.bankName!==details.bankName||previous.accountName!==details.accountName||previous.accountNumber!==details.accountNumber;
    const replaceQr=qrImage!==undefined||accountChanged&&!!previous.qrImageVersion;
    const qrImageVersion=replaceQr?image?.imageVersion??null:previous.qrImageVersion??null;
    if (!accountChanged && (previous.qrImageVersion??null)===qrImageVersion) return previous;
    if (previous.version !== expectedVersion) throw Error('WEBSITE_PAYMENT_SETTINGS_CONFLICT');
    const next = {...details, version: randomUUID(),...(replaceQr?{qrImageData:image?.imageData??null,qrImageMime:image?.imageMime??null,qrImageVersion}:{})};
    let savedDetails:WebsitePaymentDetails;
    if (previous.version === null) {
      savedDetails=await tx.websitePaymentSettings.create({data: {id: 'active', ...next}, select: fields});
    } else {
      const saved = await tx.websitePaymentSettings.updateMany({where: {id: 'active', version: expectedVersion!}, data: next});
      if (saved.count !== 1) throw Error('WEBSITE_PAYMENT_SETTINGS_CONFLICT');
      savedDetails=await loadWebsitePaymentSettings(tx);
    }
    await tx.auditLog.create({data: {
      actor, action: 'WEBSITE_PAYMENT_SETTINGS_UPDATED', entityId: 'active',
      details: {
        configured: websitePaymentReady(savedDetails),
        qrConfigured:!!qrImageVersion,
        before: {bankName: previous.bankName, accountName: previous.accountName, accountNumberLast4: previous.accountNumber.slice(-4)},
        after: {bankName: next.bankName, accountName: next.accountName, accountNumberLast4: next.accountNumber.slice(-4)},
      },
    }});
    return savedDetails;
  });
}
