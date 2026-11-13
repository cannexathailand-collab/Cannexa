import {test} from 'node:test';
import assert from 'node:assert/strict';
import {driveOperators,type Role} from '../src/lib/accounts';
import {POST as connect} from '../src/app/api/admin/drive/connect/route';
import {POST as settings} from '../src/app/api/admin/drive/settings/route';
import {GET as callback} from '../src/app/api/admin/gmail/callback/route';
test('Drive connection management is available to owners and store staff only',()=>{
 for(const role of ['owner','store'] as Role[])assert.ok(driveOperators.includes(role));
 for(const role of ['admin','manager','viewer','employee','sales'] as Role[])assert.ok(!driveOperators.includes(role));
});
test('Drive writes reject requests without an authenticated account',async()=>{
 assert.equal((await connect()).status,403);
 assert.equal((await settings(new Request('https://example.com/api/admin/drive/settings',{method:'POST'}))).status,403);
});
test('expired Drive and Gmail callbacks return to their own connection pages',async t=>{
 const previous=process.env.APP_URL;process.env.APP_URL='https://example.com';t.after(()=>{if(previous===undefined)delete process.env.APP_URL;else process.env.APP_URL=previous;});
 const drive=await callback(new Request('https://example.com/api/admin/gmail/callback?state=drive.invalid'));
 assert.equal(drive.status,303);assert.equal(drive.headers.get('location'),'https://example.com/admin/drive?status=session-expired');
 const gmail=await callback(new Request('https://example.com/api/admin/gmail/callback?state=gmail.invalid'));
 assert.equal(gmail.headers.get('location'),'https://example.com/admin/gmail?status=session-expired');
});
