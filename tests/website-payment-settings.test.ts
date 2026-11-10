import assert from 'node:assert/strict';
import {test, type TestContext} from 'node:test';
import {db} from '../src/lib/db';
import {loadWebsitePaymentSettings, saveWebsitePaymentSettings} from '../src/lib/website-payment-settings';
import {websitePaymentReady, websiteShippingFees, type WebsitePaymentDetails} from '../src/lib/website-payment';

const details = {bankName: 'ธนาคารทดสอบ', accountName: 'บัญชีทดสอบ', accountNumber: '1234567890'};

function settingsStore(t: TestContext) {
  const original = db.$transaction;
  let row: WebsitePaymentDetails | null = null;
  let writes = 0;
  const audits: any[] = [];
  const publicRow=()=>row&&({bankName:row.bankName,accountName:row.accountName,accountNumber:row.accountNumber,version:row.version,qrImageVersion:row.qrImageVersion??null});
  const tx = {
    $queryRawUnsafe: async (_query: string, key: string) => {assert.equal(key, 'website-payment-settings:active');},
    websitePaymentSettings: {
      findUnique: async () => publicRow(),
      create: async ({data}: any) => {row = {...data}; writes++; return publicRow();},
      updateMany: async ({where, data}: any) => {
        if (!row || row.version !== where.version) return {count: 0};
        row = {...row, ...data}; writes++; return {count: 1};
      },
    },
    auditLog: {create: async ({data}: any) => {audits.push(data);}},
  };
  (db as any).$transaction = async (callback: any) => callback(tx);
  t.after(() => {db.$transaction = original;});
  return {tx, audits, writes: () => writes, row: () => row};
}

test('empty settings have no invented bank details and payment fees are in satang', async () => {
  const client = {websitePaymentSettings: {findUnique: async ({where}: any) => {assert.deepEqual(where, {id: 'active'}); return null;}}};
  const empty = await loadWebsitePaymentSettings(client as any);
  assert.deepEqual(empty, {bankName: '', accountName: '', accountNumber: '', version: null});
  assert.equal(websitePaymentReady(empty), false);
  assert.deepEqual(websiteShippingFees, {TRANSFER: 5000, COD: 10000});
});

test('settings normalize account formatting and mask the account number in audit history', async t => {
  const store = settingsStore(t);
  const saved = await saveWebsitePaymentSettings('owner', {
    bankName: '  ธนาคารทดสอบ  ', accountName: ' บัญชี   ทดสอบ ',
    accountNumber: '１２３-４５６ ７８９０', expectedVersion: null,
  });
  assert.equal(saved.bankName, details.bankName);
  assert.equal(saved.accountName, 'บัญชี ทดสอบ');
  assert.equal(saved.accountNumber, details.accountNumber);
  assert.match(saved.version!, /^[0-9a-f-]{36}$/);
  assert.equal(websitePaymentReady(saved), true);
  assert.equal(websitePaymentReady({...saved, accountNumber: '123-456 7890'}), true);
  assert.equal(store.writes(), 1);
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].actor, 'owner');
  assert.equal(store.audits[0].action, 'WEBSITE_PAYMENT_SETTINGS_UPDATED');
  assert.equal(store.audits[0].details.after.accountNumberLast4, '7890');
  assert.ok(!JSON.stringify(store.audits).includes(details.accountNumber));
});

test('invalid or partial bank settings never write', async t => {
  const store = settingsStore(t);
  const invalid = [
    {...details, accountName: ''},
    {...details, accountNumber: ''},
    {...details, accountNumber: '12345'},
    {...details, accountNumber: '1'.repeat(31)},
    {...details, accountNumber: '123456ABC'},
    {...details, bankName: '㍿'.repeat(30)},
  ];
  for (const input of invalid) await assert.rejects(saveWebsitePaymentSettings('owner', {...input, expectedVersion: null}), /INVALID_WEBSITE_PAYMENT_SETTINGS/);
  await assert.rejects(saveWebsitePaymentSettings('owner', {...details, expectedVersion: 'invalid'}), /INVALID_WEBSITE_PAYMENT_SETTINGS/);
  assert.equal(store.writes(), 0);
  assert.equal(store.audits.length, 0);
});

test('settings use version compare-and-swap and retry identical data without duplicate writes', async t => {
  const store = settingsStore(t);
  const first = await saveWebsitePaymentSettings('owner', {...details, expectedVersion: null});
  const replay = await saveWebsitePaymentSettings('owner', {...details, expectedVersion: null});
  assert.equal(replay.version, first.version);
  assert.equal(store.writes(), 1);
  assert.equal(store.audits.length, 1);
  await assert.rejects(saveWebsitePaymentSettings('owner', {...details, accountNumber: '9876543210', expectedVersion: null}), /WEBSITE_PAYMENT_SETTINGS_CONFLICT/);
  const updated = await saveWebsitePaymentSettings('owner', {...details, accountNumber: '9876543210', expectedVersion: first.version});
  assert.notEqual(updated.version, first.version);
  assert.equal(store.writes(), 2);
  await assert.rejects(saveWebsitePaymentSettings('owner', {...details, accountName: 'อีกบัญชี', expectedVersion: first.version}), /WEBSITE_PAYMENT_SETTINGS_CONFLICT/);
});

test('clearing every field disables bank transfer and retains a versioned record', async t => {
  const store = settingsStore(t);
  const first = await saveWebsitePaymentSettings('owner', {...details, expectedVersion: null});
  const cleared = await saveWebsitePaymentSettings('owner', {bankName: '', accountName: ' ', accountNumber: '', expectedVersion: first.version});
  assert.equal(websitePaymentReady(cleared), false);
  assert.deepEqual({...cleared, version: null}, {bankName: '', accountName: '', accountNumber: '', version: null,qrImageVersion:null});
  assert.notEqual(cleared.version, first.version);
  assert.equal(store.audits[1].details.configured, false);
  assert.equal(store.row()?.version, cleared.version);
});

test('payment QR saves with a version, survives replay, and is removed on account changes',async t=>{
 const store=settingsStore(t);
 const qrImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const first=await saveWebsitePaymentSettings('owner',{...details,expectedVersion:null,qrImage});
 assert.match(first.qrImageVersion!,/^[a-f0-9]{64}$/);
 assert.equal('qrImageData' in first,false);
 const replay=await saveWebsitePaymentSettings('owner',{...details,expectedVersion:null,qrImage});
 assert.equal(replay.version,first.version);assert.equal(store.writes(),1);
 const changed=await saveWebsitePaymentSettings('owner',{...details,accountNumber:'9876543210',expectedVersion:first.version});
 assert.equal(changed.qrImageVersion,null);
 assert.equal(store.audits[1].details.qrConfigured,false);
});

test('payment QR can be deleted and malformed images do not replace it',async t=>{
 const store=settingsStore(t);
 const qrImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const first=await saveWebsitePaymentSettings('owner',{...details,expectedVersion:null,qrImage});
 await assert.rejects(saveWebsitePaymentSettings('owner',{...details,expectedVersion:first.version,qrImage:'data:image/png;base64,QUJDRA=='}),/INVALID_REWARD_IMAGE/);
 assert.equal(store.writes(),1);
 const removed=await saveWebsitePaymentSettings('owner',{...details,expectedVersion:first.version,qrImage:null});
 assert.equal(removed.qrImageVersion,null);
 assert.notEqual(removed.version,first.version);
});
