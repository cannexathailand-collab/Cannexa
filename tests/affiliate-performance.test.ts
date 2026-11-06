import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {AdditionalCommission} from '@prisma/client';
import {summarizeAffiliatePerformance} from '../src/lib/affiliate-performance';
import type {SaleRow} from '../src/lib/sales-report';
const at=new Date('2026-11-06T10:00:00Z'),from=new Date('2026-11-01');
const friends=[{id:'a',code:'A',name:'Referrer',active:true,clicks:3,logins:2,friends:1,approved:1,pending:0,rejected:0,employeeAccounts:[],commissionSatang:100,paidSatang:40},{id:'b',code:'B',name:'Closer',active:true,clicks:0,logins:0,friends:0,approved:0,pending:0,rejected:0,employeeAccounts:[{username:'seller'}],commissionSatang:0,paidSatang:0}];
function sale(extra:Partial<SaleRow>={}):SaleRow{return {id:'s',orderId:'o',affiliateId:'a',revenueSatang:10000,commissionSatang:200,status:'PENDING',paymentMethod:'TRANSFER',tracking:'t',recognizedAt:at,createdAt:at,order:{id:'o',orderNumber:'o',payment:'โอน',status:'TRANSFER_RECORDED',sellerUsername:'seller',sellerCode:'B'},shipment:{orderId:'o',tracking:'t',fulfillmentStatus:'DISPATCHED',status:'MATCHED_TRANSFER',dispatchedAt:at},customer:{code:'c',legacy:false,referrerId:'a',referrer:null,metaFbc:null},receipt:null,...extra} as SaleRow;}
test('overview attributes one sale to referrer and closer without duplicating their commissions',()=>{
 const extra={affiliateId:'b',createdAt:at,status:'PAID',amountSatang:80,paidAmountSatang:80} as AdditionalCommission;
 const [a,b]=summarizeAffiliatePerformance(friends,[sale()],[extra],[],from);
 assert.equal(a.referredRevenueSatang,10000);assert.equal(a.closedRevenueSatang,0);assert.equal(a.referredCustomers,1);
 assert.equal(b.closedRevenueSatang,10000);assert.equal(b.referredRevenueSatang,0);assert.equal(b.closedCount,1);
 assert.equal(a.totalCommissionSatang,300);assert.equal(a.pendingCommissionSatang,260);assert.equal(a.paidCommissionSatang,40);
 assert.equal(b.totalCommissionSatang,80);assert.equal(b.paidCommissionSatang,80);
});
test('overview keeps dispatch-date sales separate from ledger-date commissions and excludes unrecognized sales',()=>{
 const old=sale({createdAt:new Date('2026-10-01'),status:'PAID',paidAmountSatang:200}),waiting=sale({id:'waiting',recognizedAt:null,status:'WAITING_COST',commissionSatang:null});
 const [a,b]=summarizeAffiliatePerformance(friends,[old,waiting],[],[],from);
 assert.equal(a.referredCount,1);assert.equal(b.closedCount,1);assert.equal(a.totalCommissionSatang,100);assert.equal(a.waitingCost,1);
 const cancelled=sale({order:{...sale().order!,status:'RETURNED'},status:'CANCELLED'});
 assert.equal(summarizeAffiliatePerformance(friends,[cancelled],[],[],from)[0].referredCount,0);
});
