import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {GET} from '../src/app/api/admin/login/route';
import {LoginContent} from '../src/app/login/login-content';

test('opening the login submission URL returns to the form instead of HTTP 405',async t=>{
 const original=process.env.APP_URL;
 process.env.APP_URL='https://example.com';
 t.after(()=>{if(original===undefined)delete process.env.APP_URL;else process.env.APP_URL=original;});
 const response=await GET();
 assert.equal(response.status,303);
 assert.equal(response.headers.get('location'),'https://example.com/login');
 assert.equal(response.headers.get('set-cookie'),null);
});

test('login distinguishes a service outage from invalid credentials and keeps the form available',async()=>{
 const unavailable=renderToStaticMarkup(LoginContent({language:'en',brand:null,error:'unavailable'}));
 assert.ok(unavailable.includes('The database is temporarily unavailable.'));
 assert.ok(!unavailable.includes('Incorrect username or password.'));
 assert.ok(unavailable.includes('action="/api/admin/login"'));
 const invalid=renderToStaticMarkup(LoginContent({language:'en',brand:null,error:'1'}));
 assert.ok(invalid.includes('Incorrect username or password.'));
});

test('login preserves an explicit Thai language selection',()=>{
 const html=renderToStaticMarkup(LoginContent({language:'th',brand:null,error:'1'}));
 assert.ok(html.includes('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'));
 assert.ok(html.includes('ชื่อผู้ใช้'));
});
